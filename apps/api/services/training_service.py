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

from apps.api.services.chat_service import ChatService
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


DEFAULT_COMPARISON_PROMPT = "Every effort moves you"
BUILDER_DATASET_ID = "instruction-builder"
CHAT_SFT_DATASET_ID = "chat-sft-lora"
THE_VERDICT_URL = (
    "https://raw.githubusercontent.com/rasbt/"
    "LLMs-from-scratch/main/ch02/01_main-chapter-code/the-verdict.txt"
)
INSTRUCTION_DATA_URL = (
    "https://raw.githubusercontent.com/rasbt/"
    "LLMs-from-scratch/main/ch07/01_main-chapter-code/instruction-data.json"
)
BUILDER_SEED_EXAMPLES = [
    {
        "split": "train",
        "instruction": "Explain what a model checkpoint is in one sentence.",
        "input": "",
        "output": (
            "A model checkpoint is a saved snapshot of model weights and "
            "training metadata that can be loaded later."
        ),
    },
    {
        "split": "train",
        "instruction": (
            "Convert the active sentence to passive: The chef cooks the meal "
            "every day."
        ),
        "input": "",
        "output": "The meal is cooked by the chef every day.",
    },
    {
        "split": "eval",
        "instruction": (
            "Summarize why splitting data into train and eval examples is useful."
        ),
        "input": "",
        "output": (
            "Train examples update the model, while eval examples help inspect "
            "whether the model generalizes beyond the data it memorized."
        ),
    },
]


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


@dataclass(frozen=True)
class DatasetSpec:
    dataset_id: str
    tier: str
    label: str
    path: Path
    description: str
    recommended_steps: int
    recommended_batch_size: int
    recommended_block_size: int
    recommended_learning_rate: float
    recommended_base_model_id: str
    comparison_prompt: str
    dataset_probe_prompt: str
    output_model_id: str
    training_objective: str = "text"
    prompt_style: str = "chat"
    learning_stage: str = "from-scratch"
    learning_stage_label: str = "From Scratch"
    learning_goal: str = "Train a tiny model from random weights."
    source_url: str | None = None


class TrainingService:
    def __init__(self, chat_service: ChatService, project_root: Path | None = None) -> None:
        self._chat_service = chat_service
        self._project_root = project_root or Path(__file__).resolve().parents[3]
        self._checkpoint_dir = self._project_root / "models" / "checkpoints"
        self._experiment_dir = self._project_root / "models" / "experiments"
        self._experiment_log = self._experiment_dir / "training-experiments.jsonl"
        self._experiment_lock = Lock()
        self._datasets = {
            "every-effort": DatasetSpec(
                dataset_id="every-effort",
                tier="tiny",
                label="Tiny repeated phrase",
                path=self._project_root / "data" / "tiny" / "every-effort.txt",
                description="The shortest repeated dataset. It should overfit quickly.",
                recommended_steps=80,
                recommended_batch_size=4,
                recommended_block_size=32,
                recommended_learning_rate=3e-3,
                recommended_base_model_id="random-tiny-byte",
                comparison_prompt=DEFAULT_COMPARISON_PROMPT,
                dataset_probe_prompt="Every effort moves you",
                output_model_id="trained-tiny-byte",
                learning_goal=(
                    "Start with a tiny random model and overfit the shortest dataset."
                ),
            ),
            "every-effort-expanded": DatasetSpec(
                dataset_id="every-effort-expanded",
                tier="small",
                label="Small phrase ladder",
                path=self._project_root / "data" / "small" / "every-effort-expanded.txt",
                description="A small set of related prompt/answer pairs with more variety.",
                recommended_steps=140,
                recommended_batch_size=4,
                recommended_block_size=32,
                recommended_learning_rate=3e-3,
                recommended_base_model_id="random-tiny-byte",
                comparison_prompt=DEFAULT_COMPARISON_PROMPT,
                dataset_probe_prompt="Small steps compound",
                output_model_id="trained-small-byte",
                learning_goal=(
                    "Increase dataset variety while still training from random weights."
                ),
            ),
            "learning-dialogues": DatasetSpec(
                dataset_id="learning-dialogues",
                tier="medium",
                label="Medium learning dialogues",
                path=self._project_root / "data" / "medium" / "learning-dialogues.txt",
                description="A larger teaching dataset about loss, checkpoints, and overfitting.",
                recommended_steps=220,
                recommended_batch_size=4,
                recommended_block_size=32,
                recommended_learning_rate=3e-3,
                recommended_base_model_id="random-tiny-byte",
                comparison_prompt=DEFAULT_COMPARISON_PROMPT,
                dataset_probe_prompt="What does training do",
                output_model_id="trained-medium-byte",
                learning_goal=(
                    "Use more examples to compare loss and generated behavior."
                ),
            ),
            "the-verdict": DatasetSpec(
                dataset_id="the-verdict",
                tier="larger",
                label="The Verdict",
                path=self._project_root / "data" / "external" / "the-verdict.txt",
                description=(
                    "A larger raw-text dataset from the reference LLM-from-scratch project."
                ),
                recommended_steps=320,
                recommended_batch_size=4,
                recommended_block_size=64,
                recommended_learning_rate=3e-3,
                recommended_base_model_id="random-tiny-byte",
                comparison_prompt="I had always thought Jack Gisburn",
                dataset_probe_prompt="I had always thought Jack Gisburn",
                output_model_id="trained-verdict-byte",
                training_objective="raw-text",
                prompt_style="raw",
                learning_stage="raw-text",
                learning_stage_label="Raw Text Pretraining",
                learning_goal=(
                    "Train next-token continuation on a larger raw text file."
                ),
                source_url=THE_VERDICT_URL,
            ),
            "instruction-following": DatasetSpec(
                dataset_id="instruction-following",
                tier="instruction",
                label="Instruction following",
                path=self._project_root / "data" / "external" / "instruction-data.json",
                description=(
                    "Instruction/response data from the reference project Chapter 7."
                ),
                recommended_steps=20,
                recommended_batch_size=1,
                recommended_block_size=256,
                recommended_learning_rate=5e-5,
                recommended_base_model_id="gpt2-124M",
                comparison_prompt="Explain what a model checkpoint is in one sentence.",
                dataset_probe_prompt="Convert the active sentence to passive: The chef cooks the meal every day.",
                output_model_id="gpt2-instruct-finetuned",
                training_objective="instruction-sft",
                prompt_style="instruction",
                learning_stage="instruction",
                learning_stage_label="Instruction SFT",
                learning_goal=(
                    "Fine-tune downloaded GPT-2 on instruction/response examples."
                ),
                source_url=INSTRUCTION_DATA_URL,
            ),
            "instruction-lora": DatasetSpec(
                dataset_id="instruction-lora",
                tier="peft",
                label="LoRA instruction tuning",
                path=self._project_root / "data" / "external" / "instruction-data.json",
                description=(
                    "Instruction/response data with frozen GPT-2 and trainable LoRA adapters."
                ),
                recommended_steps=20,
                recommended_batch_size=1,
                recommended_block_size=256,
                recommended_learning_rate=3e-4,
                recommended_base_model_id="gpt2-124M",
                comparison_prompt="Explain what a model checkpoint is in one sentence.",
                dataset_probe_prompt="Convert the active sentence to passive: The chef cooks the meal every day.",
                output_model_id="gpt2-instruct-lora",
                training_objective="instruction-lora",
                prompt_style="instruction",
                learning_stage="lora",
                learning_stage_label="LoRA / PEFT",
                learning_goal=(
                    "Freeze GPT-2 and train low-rank attention adapters."
                ),
                source_url=INSTRUCTION_DATA_URL,
            ),
            CHAT_SFT_DATASET_ID: DatasetSpec(
                dataset_id=CHAT_SFT_DATASET_ID,
                tier="chat",
                label="Minimal chat SFT",
                path=self._project_root / "data" / "chat" / "chat-sft-mini.json",
                description=(
                    "Small multi-turn chat transcripts for a first ChatGPT-like "
                    "conversation checkpoint."
                ),
                recommended_steps=240,
                recommended_batch_size=1,
                recommended_block_size=384,
                recommended_learning_rate=3e-4,
                recommended_base_model_id="gpt2-124M",
                comparison_prompt="who are you?",
                dataset_probe_prompt="What is my name?",
                output_model_id="gpt2-chat-lora",
                training_objective="chat-lora",
                prompt_style="chat",
                learning_stage="chat-sft",
                learning_stage_label="Chat SFT",
                learning_goal=(
                    "Fine-tune GPT-2 with LoRA on multi-turn chat transcripts so "
                    "Conversation can answer from session context."
                ),
            ),
            BUILDER_DATASET_ID: DatasetSpec(
                dataset_id=BUILDER_DATASET_ID,
                tier="custom",
                label="Dataset builder",
                path=self._project_root / "data" / "custom" / "instruction-builder.json",
                description="Editable instruction examples created from the Web UI.",
                recommended_steps=20,
                recommended_batch_size=1,
                recommended_block_size=256,
                recommended_learning_rate=5e-5,
                recommended_base_model_id="gpt2-124M",
                comparison_prompt="Explain what a model checkpoint is in one sentence.",
                dataset_probe_prompt=(
                    "Summarize why splitting data into train and eval examples is useful."
                ),
                output_model_id="gpt2-builder-finetuned",
                training_objective="instruction-sft",
                prompt_style="instruction",
                learning_stage="dataset-builder",
                learning_stage_label="Dataset Builder",
                learning_goal=(
                    "Build custom train/eval instruction examples before fine-tuning GPT-2."
                ),
            ),
        }

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


def _compare_experiments(left: dict, right: dict) -> dict:
    same = {
        "prompt": (
            (left.get("comparison_prompt") or left.get("sample_prompt"))
            == (right.get("comparison_prompt") or right.get("sample_prompt"))
        ),
        "dataset": left.get("dataset_id") == right.get("dataset_id"),
        "base_model": left.get("base_model_id") == right.get("base_model_id"),
        "objective": left.get("training_objective")
        == right.get("training_objective"),
        "tuning": (left.get("tuning_method") or "full")
        == (right.get("tuning_method") or "full"),
    }
    deltas = {
        "final_loss": _metric_delta(left, right, "final_loss", prefer="lower"),
        "tokens_seen": _metric_delta(left, right, "tokens_seen"),
        "max_steps": _metric_delta(left, right, "max_steps"),
        "dataset_tokens": _metric_delta(left, right, "dataset_tokens"),
        "trainable_percent": _metric_delta(left, right, "trainable_percent"),
        "examples_used_for_training": _metric_delta(
            left,
            right,
            "examples_used_for_training",
        ),
    }
    return {
        "left_id": left.get("experiment_id"),
        "right_id": right.get("experiment_id"),
        "left_version": _experiment_version(left),
        "right_version": _experiment_version(right),
        "same": same,
        "deltas": deltas,
        "notes": _comparison_notes(same, deltas),
    }


def _experiment_version(experiment: dict) -> dict:
    return {
        "model_id": experiment.get("output_model_id"),
        "checkpoint_id": experiment.get("checkpoint_id"),
        "version_id": experiment.get("model_version_id"),
        "version_label": experiment.get("model_version_label"),
        "lineage": experiment.get("lineage"),
    }


def _metric_delta(
    left: dict,
    right: dict,
    key: str,
    *,
    prefer: str | None = None,
) -> dict:
    left_value = _as_number(left.get(key))
    right_value = _as_number(right.get(key))
    if left_value is None or right_value is None:
        return {
            "left": left.get(key),
            "right": right.get(key),
            "delta": None,
            "status": "unknown",
        }

    delta = right_value - left_value
    status = "same"
    if delta != 0:
        status = "changed"
        if prefer == "lower":
            status = "better" if delta < 0 else "worse"
        elif prefer == "higher":
            status = "better" if delta > 0 else "worse"

    return {
        "left": left_value,
        "right": right_value,
        "delta": delta,
        "status": status,
    }


def _comparison_notes(same: dict, deltas: dict) -> list[str]:
    notes = []
    notes.append(
        "The comparison prompt matches."
        if same["prompt"]
        else "The comparison prompts differ; output comparison is less controlled."
    )
    if not same["dataset"]:
        notes.append("The two runs used different datasets.")
    if not same["base_model"]:
        notes.append("The two runs started from different base models.")
    if not same["tuning"]:
        notes.append("The two runs used different tuning methods.")

    loss_status = deltas["final_loss"]["status"]
    if loss_status == "better":
        notes.append("The right experiment has lower final loss.")
    elif loss_status == "worse":
        notes.append("The right experiment has higher final loss.")
    return notes


def _as_number(value: object) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except ValueError:
        return None


def _preview_text(text: str, limit: int = 220) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3] + "..."


def _seed_builder_examples() -> list[dict]:
    now = _utc_now()
    return [
        _normalize_builder_example(
            {
                **example,
                "example_id": str(uuid4()),
                "created_at": now,
                "updated_at": now,
            }
        )
        for example in BUILDER_SEED_EXAMPLES
    ]


def _normalize_builder_example(raw_example: dict) -> dict:
    now = _utc_now()
    split = str(raw_example.get("split", "train")).strip().lower()
    if split not in {"train", "eval"}:
        raise ValueError("Builder example split must be 'train' or 'eval'.")

    instruction = str(raw_example.get("instruction", "")).strip()
    output = str(raw_example.get("output", "")).strip()
    input_text = str(raw_example.get("input", "")).strip()
    if not instruction:
        raise ValueError("Builder example instruction is required.")
    if not output:
        raise ValueError("Builder example output is required.")

    return {
        "example_id": str(
            raw_example.get("example_id") or raw_example.get("id") or uuid4()
        ),
        "split": split,
        "instruction": instruction,
        "input": input_text,
        "output": output,
        "created_at": str(raw_example.get("created_at") or now),
        "updated_at": str(raw_example.get("updated_at") or now),
    }


def _instruction_split_counts(entries: object) -> dict:
    counts = {"train": 0, "eval": 0}
    if not isinstance(entries, list):
        return counts

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        split = str(entry.get("split", "train")).strip().lower()
        if split == "eval":
            counts["eval"] += 1
        else:
            counts["train"] += 1
    return counts


def _chat_split_counts(entries: object) -> dict:
    counts = {"train": 0, "eval": 0}
    if not isinstance(entries, list):
        return counts

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        split = str(entry.get("split", "train")).strip().lower()
        if split == "eval":
            counts["eval"] += 1
        else:
            counts["train"] += 1
    return counts


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _instruction_dataset_metadata(text: str) -> dict:
    template = (
        "Below is an instruction that describes a task. "
        "Write a response that appropriately completes the request."
        "\n\n### Instruction:\n{instruction}"
        "\n\n### Input:\n{input}"
        "\n\n### Response:\n{output}"
    )
    if not text:
        return {
            "example_count": 0,
            "instruction_template": template,
            "instruction_example": None,
            "formatted_prompt_preview": "",
            "target_response_preview": "",
            "train_examples": 0,
            "eval_examples": 0,
        }

    try:
        entries = json.loads(text)
    except json.JSONDecodeError:
        return {
            "example_count": 0,
            "instruction_template": template,
            "instruction_example": None,
            "formatted_prompt_preview": "",
            "target_response_preview": "",
            "train_examples": 0,
            "eval_examples": 0,
        }

    split_counts = _instruction_split_counts(entries)
    example = _first_instruction_example(entries)
    if example is None:
        return {
            "example_count": len(entries) if isinstance(entries, list) else 0,
            "instruction_template": template,
            "instruction_example": None,
            "formatted_prompt_preview": "",
            "target_response_preview": "",
            "train_examples": split_counts["train"],
            "eval_examples": split_counts["eval"],
        }

    input_text = example.get("input", "")
    formatted_prompt = format_instruction_prompt(example["instruction"], input_text)
    return {
        "example_count": len(entries),
        "instruction_template": template,
        "instruction_example": {
            "instruction": example["instruction"],
            "input": input_text,
            "output": example["output"],
        },
        "formatted_prompt_preview": formatted_prompt + "\n\n### Response:",
        "target_response_preview": example["output"],
        "train_examples": split_counts["train"],
        "eval_examples": split_counts["eval"],
    }


def _first_instruction_example(entries: object) -> dict | None:
    if not isinstance(entries, list):
        return None
    for entry in entries:
        if (
            isinstance(entry, dict)
            and isinstance(entry.get("instruction"), str)
            and isinstance(entry.get("output"), str)
        ):
            return entry
    return None


def _chat_dataset_metadata(text: str) -> dict:
    template = (
        "System: {system}\n"
        "User: {user message}\n"
        "Assistant: {assistant response}\n"
        "User: {latest user message}\n"
        "Assistant:"
    )
    empty = {
        "example_count": 0,
        "chat_template": template,
        "chat_example": None,
        "formatted_prompt_preview": "",
        "target_response_preview": "",
        "chat_training_pairs": 0,
        "train_examples": 0,
        "eval_examples": 0,
    }
    if not text:
        return empty

    try:
        entries = json.loads(text)
    except json.JSONDecodeError:
        return empty
    if not isinstance(entries, list):
        return empty

    split_counts = _chat_split_counts(entries)
    example = _first_chat_example(entries)
    training_pairs = sum(_count_assistant_turns(entry) for entry in entries)
    if example is None:
        return {
            **empty,
            "example_count": len(entries),
            "chat_training_pairs": training_pairs,
            "train_examples": split_counts["train"],
            "eval_examples": split_counts["eval"],
        }

    prompt, target = _first_chat_pair(example)
    return {
        "example_count": len(entries),
        "chat_template": template,
        "chat_example": {
            "system": str(example.get("system", "")),
            "messages": example.get("messages", []),
        },
        "formatted_prompt_preview": prompt,
        "target_response_preview": target,
        "chat_training_pairs": training_pairs,
        "train_examples": split_counts["train"],
        "eval_examples": split_counts["eval"],
    }


def _first_chat_example(entries: object) -> dict | None:
    if not isinstance(entries, list):
        return None
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if _first_chat_pair(entry)[0]:
            return entry
    return None


def _first_chat_pair(entry: dict) -> tuple[str, str]:
    messages = entry.get("messages")
    if not isinstance(messages, list):
        return "", ""

    history: list[dict] = []
    system_prompt = str(entry.get("system", "")).strip()
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role", "")).strip().lower()
        content = str(message.get("content", "")).strip()
        if not content:
            continue
        if role == "system":
            system_prompt = content
        elif role == "user":
            history.append({"role": "user", "content": content})
        elif role == "assistant":
            prompt = format_chat_transcript(
                system_prompt,
                history,
                append_assistant_prompt=True,
            )
            return prompt, content
    return "", ""


def _count_assistant_turns(entry: object) -> int:
    if not isinstance(entry, dict) or not isinstance(entry.get("messages"), list):
        return 0
    return sum(
        1
        for message in entry["messages"]
        if isinstance(message, dict)
        and str(message.get("role", "")).strip().lower() == "assistant"
        and str(message.get("content", "")).strip()
    )
