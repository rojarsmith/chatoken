from __future__ import annotations

import json
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Callable
from uuid import uuid4

import requests
import torch

from apps.api.services import device_service
from apps.api.services.chat_service import ChatService
from apps.api.services.dataset_inspect import (
    _chat_dataset_metadata,
    _chat_split_counts,
    _instruction_dataset_metadata,
    _instruction_split_counts,
    _normalize_builder_example,
    _preview_text,
    _seed_builder_examples,
    _utc_now,
)
from apps.api.services.dataset_registry import (
    BUILDER_DATASET_ID,
    CHAT_SFT_DATASET_ID,
    DEFAULT_COMPARISON_PROMPT,
    DatasetSpec,
    build_dataset_registry,
)
from apps.api.services.experiment_compare import _compare_experiments
from llm_core.checkpoints import save_checkpoint
from llm_core.generation import format_chat_transcript, format_instruction_prompt
from llm_core.lora import (
    LoRAConfig,
    apply_lora,
    count_total_parameters,
    count_trainable_parameters,
    merge_lora_weights,
)
from llm_core.tokenizer import ByteTokenizer
from llm_core.training import (
    TrainingConfig,
    generate_sample,
    train_chat_language_model,
    train_instruction_language_model,
    train_tiny_language_model,
)


@dataclass(frozen=True)
class TrainingRequestData:
    dataset_id: str
    base_model_id: str
    output_model_id: str
    max_steps: int
    batch_size: int
    block_size: int
    learning_rate: float
    eval_every: int
    sample_prompt: str
    load_when_complete: bool
    job_id: str | None = None


class TrainingService:
    def __init__(self, chat_service: ChatService, project_root: Path | None = None) -> None:
        self._chat_service = chat_service
        self._project_root = project_root or Path(__file__).resolve().parents[3]
        self._checkpoint_dir = self._project_root / "models" / "checkpoints"
        self._experiment_dir = self._project_root / "models" / "experiments"
        self._experiment_log = self._experiment_dir / "training-experiments.jsonl"
        self._experiment_lock = Lock()
        self._datasets = build_dataset_registry(self._project_root)

    def list_datasets(self) -> list[dict]:
        self._ensure_dataset(self._datasets[BUILDER_DATASET_ID])
        return [self._dataset_metadata(spec) for spec in self._datasets.values()]

    def prepare_dataset(self, dataset_id: str) -> dict:
        dataset = self._datasets.get(dataset_id)
        if dataset is None:
            raise ValueError(f"Unknown dataset_id: {dataset_id}")
        self._ensure_dataset(dataset)
        return self._dataset_metadata(dataset)

    def get_builder_dataset(self) -> dict:
        dataset = self._datasets[BUILDER_DATASET_ID]
        self._ensure_dataset(dataset)
        return self._builder_dataset_payload()

    def seed_builder_dataset(self) -> dict:
        dataset = self._datasets[BUILDER_DATASET_ID]
        dataset.path.parent.mkdir(parents=True, exist_ok=True)
        if not dataset.path.exists() or not self._read_builder_examples():
            self._write_builder_examples(_seed_builder_examples())
        return self._builder_dataset_payload()

    def create_builder_example(self, payload: dict) -> dict:
        self._ensure_dataset(self._datasets[BUILDER_DATASET_ID])
        examples = self._read_builder_examples()
        now = _utc_now()
        examples.append(
            _normalize_builder_example(
                {
                    **payload,
                    "example_id": str(uuid4()),
                    "created_at": now,
                    "updated_at": now,
                }
            )
        )
        self._write_builder_examples(examples)
        return self._builder_dataset_payload()

    def update_builder_example(self, example_id: str, payload: dict) -> dict:
        self._ensure_dataset(self._datasets[BUILDER_DATASET_ID])
        examples = self._read_builder_examples()
        now = _utc_now()
        for index, example in enumerate(examples):
            if example["example_id"] == example_id:
                examples[index] = _normalize_builder_example(
                    {
                        **example,
                        **payload,
                        "example_id": example_id,
                        "created_at": example.get("created_at") or now,
                        "updated_at": now,
                    }
                )
                self._write_builder_examples(examples)
                return self._builder_dataset_payload()
        raise FileNotFoundError(f"Builder example not found: {example_id}")

    def delete_builder_example(self, example_id: str) -> dict:
        self._ensure_dataset(self._datasets[BUILDER_DATASET_ID])
        examples = self._read_builder_examples()
        next_examples = [
            example for example in examples if example["example_id"] != example_id
        ]
        if len(next_examples) == len(examples):
            raise FileNotFoundError(f"Builder example not found: {example_id}")
        self._write_builder_examples(next_examples)
        return self._builder_dataset_payload()

    def list_experiments(self) -> list[dict]:
        if not self._experiment_log.exists():
            return []

        experiments = []
        with self._experiment_log.open("r", encoding="utf-8") as file:
            for line in file:
                line = line.strip()
                if not line:
                    continue
                try:
                    experiments.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return list(reversed(experiments))

    def compare_experiments(self, left_id: str, right_id: str) -> dict:
        experiments = {
            experiment["experiment_id"]: experiment
            for experiment in self.list_experiments()
        }
        left = experiments.get(left_id)
        right = experiments.get(right_id)
        if left is None:
            raise FileNotFoundError(f"Experiment not found: {left_id}")
        if right is None:
            raise FileNotFoundError(f"Experiment not found: {right_id}")
        return _compare_experiments(left, right)

    def train(
        self,
        request: TrainingRequestData,
        progress_callback: Callable[[dict], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
    ) -> dict:
        dataset = self._datasets.get(request.dataset_id)
        if dataset is None:
            raise ValueError(f"Unknown dataset_id: {request.dataset_id}")
        self._ensure_dataset(dataset)

        base_model = self._chat_service.clone_model_for_training(request.base_model_id)
        model_config = replace(base_model.config, prompt_style=dataset.prompt_style)
        tokenizer = base_model.tokenizer
        device = base_model.device
        model = base_model.model
        torch.manual_seed(model_config.seed)
        model.eval()
        if request.block_size > model_config.context_length:
            raise ValueError(
                f"block_size={request.block_size} exceeds "
                f"{request.base_model_id} context_length={model_config.context_length}."
            )

        sample_tokens = 80 if dataset.prompt_style in {"instruction", "chat"} else 24
        before_sample = generate_sample(
            model=model,
            tokenizer=tokenizer,
            prompt=request.sample_prompt,
            device=device,
            context_size=model_config.context_length,
            max_new_tokens=sample_tokens,
            prompt_style=dataset.prompt_style,
        )
        training_config = TrainingConfig(
            max_steps=request.max_steps,
            batch_size=request.batch_size,
            block_size=request.block_size,
            learning_rate=request.learning_rate,
            eval_every=request.eval_every,
            sample_prompt=request.sample_prompt,
            prompt_style=dataset.prompt_style,
            sample_tokens=sample_tokens,
            seed=model_config.seed,
        )
        lora_summary = None
        if dataset.training_objective in {"instruction-lora", "chat-lora"}:
            lora_config = (
                LoRAConfig(
                    target_modules=("W_query", "W_key", "W_value", "out_proj")
                )
                if dataset.training_objective == "chat-lora"
                else LoRAConfig()
            )
            lora_summary = apply_lora(model, lora_config)

        instruction_entries = None
        chat_entries = None
        if dataset.training_objective in {"instruction-sft", "instruction-lora"}:
            instruction_entries = self._read_instruction_entries(dataset)
            training_summary = train_instruction_language_model(
                model=model,
                tokenizer=tokenizer,
                entries=instruction_entries,
                device=device,
                config=training_config,
                progress_callback=progress_callback,
                should_cancel=should_cancel,
            )
        elif dataset.training_objective in {"chat-sft", "chat-lora"}:
            chat_entries = self._read_chat_entries(dataset)
            training_summary = train_chat_language_model(
                model=model,
                tokenizer=tokenizer,
                entries=chat_entries,
                device=device,
                config=training_config,
                progress_callback=progress_callback,
                should_cancel=should_cancel,
            )
        else:
            training_summary = train_tiny_language_model(
                model=model,
                tokenizer=tokenizer,
                text=dataset.path.read_text(encoding="utf-8"),
                device=device,
                config=training_config,
                progress_callback=progress_callback,
                should_cancel=should_cancel,
            )
        training_summary["before_sample"] = before_sample
        training_summary["dataset_id"] = request.dataset_id
        training_summary["dataset_tier"] = dataset.tier
        training_summary["dataset_label"] = dataset.label
        training_summary["dataset_path"] = str(dataset.path)
        training_summary["training_objective"] = dataset.training_objective
        training_summary["prompt_style"] = dataset.prompt_style
        training_summary["learning_stage"] = dataset.learning_stage
        training_summary["learning_stage_label"] = dataset.learning_stage_label
        training_summary["learning_goal"] = dataset.learning_goal
        training_summary["base_model_id"] = request.base_model_id
        training_summary["output_model_id"] = request.output_model_id
        training_summary["eval_every"] = request.eval_every
        training_summary["seed"] = model_config.seed
        training_summary["training_config"] = {
            "max_steps": request.max_steps,
            "batch_size": request.batch_size,
            "block_size": request.block_size,
            "learning_rate": request.learning_rate,
            "eval_every": request.eval_every,
            "seed": model_config.seed,
        }
        training_summary["comparison_prompt"] = request.sample_prompt
        training_summary["dataset_probe_prompt"] = dataset.dataset_probe_prompt
        if instruction_entries is not None:
            split_counts = _instruction_split_counts(
                json.loads(dataset.path.read_text(encoding="utf-8"))
            )
            training_summary["train_examples"] = split_counts["train"]
            training_summary["eval_examples"] = split_counts["eval"]
            training_summary["examples_used_for_training"] = len(instruction_entries)
        if chat_entries is not None:
            split_counts = _chat_split_counts(
                json.loads(dataset.path.read_text(encoding="utf-8"))
            )
            training_summary["train_examples"] = split_counts["train"]
            training_summary["eval_examples"] = split_counts["eval"]
            training_summary["examples_used_for_training"] = len(chat_entries)
            training_summary["chat_training_pairs"] = training_summary.get(
                "chat_training_pairs"
            )
        training_summary["device"] = str(device)
        training_summary["cuda_available"] = torch.cuda.is_available()
        training_summary["device_preference"] = device_service.get_preference()
        training_summary["device_name"] = (
            torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        )
        training_summary["total_parameters"] = count_total_parameters(model)
        training_summary["trainable_parameters"] = count_trainable_parameters(model)
        training_summary["trainable_percent"] = round(
            (
                training_summary["trainable_parameters"]
                / training_summary["total_parameters"]
            )
            * 100,
            4,
        )
        training_summary["tuning_method"] = "lora" if lora_summary else "full"
        if lora_summary:
            training_summary["lora"] = lora_summary
            training_summary["merged_lora_modules"] = merge_lora_weights(model)
            training_summary["checkpoint_adapter_format"] = "merged-full-checkpoint"

        checkpoint = save_checkpoint(
            checkpoint_dir=self._checkpoint_dir,
            model=model,
            model_id=request.output_model_id,
            base_model_id=request.base_model_id,
            model_config=model_config,
            tokenizer_name=model_config.tokenizer,
            training_summary=training_summary,
        )

        loaded = None
        if request.load_when_complete:
            loaded = self._chat_service.load_checkpoint_model(
                checkpoint_id=checkpoint["checkpoint_id"],
                model_id=request.output_model_id,
            )

        experiment = self._record_experiment(
            request=request,
            dataset=dataset,
            checkpoint=checkpoint,
            training_summary=training_summary,
            loaded_model=loaded,
        )

        return {
            "checkpoint": checkpoint,
            "loaded_model": loaded,
            "training_summary": training_summary,
            "experiment": experiment,
        }

    def _ensure_dataset(self, dataset: DatasetSpec) -> None:
        if dataset.path.exists():
            return
        if dataset.dataset_id == BUILDER_DATASET_ID:
            dataset.path.parent.mkdir(parents=True, exist_ok=True)
            self._write_builder_examples(_seed_builder_examples())
            return
        if dataset.source_url is None:
            raise FileNotFoundError(f"Dataset file not found: {dataset.path}")

        dataset.path.parent.mkdir(parents=True, exist_ok=True)
        response = requests.get(dataset.source_url, timeout=60)
        response.raise_for_status()
        dataset.path.write_text(response.text, encoding="utf-8")

    def _read_instruction_entries(self, dataset: DatasetSpec) -> list[dict]:
        entries = json.loads(dataset.path.read_text(encoding="utf-8"))
        if not isinstance(entries, list):
            raise ValueError(f"Instruction dataset must be a JSON list: {dataset.path}")
        if dataset.dataset_id != BUILDER_DATASET_ID:
            return entries

        train_entries = [
            entry
            for entry in entries
            if isinstance(entry, dict)
            and str(entry.get("split", "train")).strip().lower() == "train"
        ]
        if not train_entries:
            raise ValueError(
                "Dataset Builder needs at least one train example before training."
            )
        return train_entries

    def _read_chat_entries(self, dataset: DatasetSpec) -> list[dict]:
        entries = json.loads(dataset.path.read_text(encoding="utf-8"))
        if not isinstance(entries, list):
            raise ValueError(f"Chat dataset must be a JSON list: {dataset.path}")
        train_entries = [
            entry
            for entry in entries
            if isinstance(entry, dict)
            and str(entry.get("split", "train")).strip().lower() == "train"
        ]
        if not train_entries:
            raise ValueError("Chat dataset needs at least one train conversation.")
        return train_entries

    def _builder_dataset_payload(self) -> dict:
        examples = self._read_builder_examples()
        metadata = self._dataset_metadata(self._datasets[BUILDER_DATASET_ID])
        metadata["examples"] = examples
        metadata["train_examples"] = sum(
            1 for example in examples if example["split"] == "train"
        )
        metadata["eval_examples"] = sum(
            1 for example in examples if example["split"] == "eval"
        )
        return metadata

    def _read_builder_examples(self) -> list[dict]:
        dataset = self._datasets[BUILDER_DATASET_ID]
        if not dataset.path.exists():
            return []
        try:
            raw_examples = json.loads(dataset.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Builder dataset is not valid JSON: {dataset.path}"
            ) from exc
        if not isinstance(raw_examples, list):
            raise ValueError(f"Builder dataset must be a JSON list: {dataset.path}")
        examples = []
        for raw_example in raw_examples:
            if isinstance(raw_example, dict):
                examples.append(_normalize_builder_example(raw_example))
        return examples

    def _write_builder_examples(self, examples: list[dict]) -> None:
        dataset = self._datasets[BUILDER_DATASET_ID]
        dataset.path.parent.mkdir(parents=True, exist_ok=True)
        normalized = [_normalize_builder_example(example) for example in examples]
        dataset.path.write_text(
            json.dumps(normalized, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def _dataset_metadata(self, spec: DatasetSpec) -> dict:
        tokenizer = ByteTokenizer()
        text = spec.path.read_text(encoding="utf-8") if spec.path.exists() else ""
        metadata = {
            "dataset_id": spec.dataset_id,
            "tier": spec.tier,
            "label": spec.label,
            "description": spec.description,
            "path": str(spec.path),
            "exists": spec.path.exists(),
            "byte_tokens": len(tokenizer.encode(text)) if text else 0,
            "bytes": len(text.encode("utf-8")) if text else 0,
            "preview": _preview_text(text),
            "recommended_steps": spec.recommended_steps,
            "recommended_batch_size": spec.recommended_batch_size,
            "recommended_block_size": spec.recommended_block_size,
            "recommended_learning_rate": spec.recommended_learning_rate,
            "recommended_base_model_id": spec.recommended_base_model_id,
            "comparison_prompt": spec.comparison_prompt,
            "dataset_probe_prompt": spec.dataset_probe_prompt,
            "sample_prompt": spec.comparison_prompt,
            "output_model_id": spec.output_model_id,
            "training_objective": spec.training_objective,
            "prompt_style": spec.prompt_style,
            "learning_stage": spec.learning_stage,
            "learning_stage_label": spec.learning_stage_label,
            "learning_goal": spec.learning_goal,
            "source_url": spec.source_url,
        }
        if spec.training_objective in {"instruction-sft", "instruction-lora"}:
            metadata.update(_instruction_dataset_metadata(text))
        if spec.training_objective in {"chat-sft", "chat-lora"}:
            metadata.update(_chat_dataset_metadata(text))
        return metadata

    def _record_experiment(
        self,
        *,
        request: TrainingRequestData,
        dataset: DatasetSpec,
        checkpoint: dict,
        training_summary: dict,
        loaded_model: dict | None,
    ) -> dict:
        created_at = datetime.now(timezone.utc).isoformat()
        experiment = {
            "experiment_id": request.job_id or str(uuid4()),
            "created_at": created_at,
            "dataset_id": dataset.dataset_id,
            "dataset_tier": dataset.tier,
            "dataset_label": dataset.label,
            "dataset_tokens": training_summary.get("dataset_tokens"),
            "training_objective": training_summary.get("training_objective"),
            "prompt_style": training_summary.get("prompt_style"),
            "learning_stage": training_summary.get("learning_stage"),
            "learning_stage_label": training_summary.get("learning_stage_label"),
            "learning_goal": training_summary.get("learning_goal"),
            "base_model_id": request.base_model_id,
            "output_model_id": request.output_model_id,
            "checkpoint_id": checkpoint["checkpoint_id"],
            "checkpoint_path": checkpoint["path"],
            "checkpoint_size_bytes": checkpoint.get("size_bytes"),
            "model_version": checkpoint.get("version"),
            "model_version_id": checkpoint.get("version_id"),
            "model_version_label": checkpoint.get("version_label"),
            "lineage": checkpoint.get("lineage"),
            "loaded_model_id": loaded_model["model_id"] if loaded_model else None,
            "max_steps": training_summary.get("max_steps"),
            "batch_size": training_summary.get("batch_size"),
            "block_size": training_summary.get("block_size"),
            "learning_rate": training_summary.get("learning_rate"),
            "eval_every": training_summary.get("eval_every"),
            "seed": training_summary.get("seed"),
            "training_config": training_summary.get("training_config"),
            "tuning_method": training_summary.get("tuning_method"),
            "trainable_parameters": training_summary.get("trainable_parameters"),
            "total_parameters": training_summary.get("total_parameters"),
            "trainable_percent": training_summary.get("trainable_percent"),
            "train_examples": training_summary.get("train_examples"),
            "eval_examples": training_summary.get("eval_examples"),
            "examples_used_for_training": training_summary.get(
                "examples_used_for_training"
            ),
            "lora": training_summary.get("lora"),
            "device": training_summary.get("device"),
            "cuda_available": training_summary.get("cuda_available"),
            "device_name": training_summary.get("device_name"),
            "tokens_seen": training_summary.get("tokens_seen"),
            "final_loss": training_summary.get("final_loss"),
            "losses": training_summary.get("losses", []),
            "comparison_prompt": training_summary.get("comparison_prompt")
            or training_summary.get("sample_prompt"),
            "dataset_probe_prompt": training_summary.get("dataset_probe_prompt"),
            "sample_prompt": training_summary.get("sample_prompt"),
            "before_sample": training_summary.get("before_sample"),
            "after_sample": training_summary.get("sample_text"),
        }

        self._experiment_dir.mkdir(parents=True, exist_ok=True)
        with self._experiment_lock:
            with self._experiment_log.open("a", encoding="utf-8") as file:
                file.write(json.dumps(experiment, ensure_ascii=False) + "\n")
        return experiment
