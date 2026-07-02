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
from llm_core.tokenizer import ByteTokenizer
from llm_core.training import (
    TrainingConfig,
    generate_sample,
    train_instruction_language_model,
    train_tiny_language_model,
)


DEFAULT_COMPARISON_PROMPT = "Every effort moves you"
THE_VERDICT_URL = (
    "https://raw.githubusercontent.com/rasbt/"
    "LLMs-from-scratch/main/ch02/01_main-chapter-code/the-verdict.txt"
)
INSTRUCTION_DATA_URL = (
    "https://raw.githubusercontent.com/rasbt/"
    "LLMs-from-scratch/main/ch07/01_main-chapter-code/instruction-data.json"
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
        }

    def list_datasets(self) -> list[dict]:
        tokenizer = ByteTokenizer()
        datasets = []
        for spec in self._datasets.values():
            text = spec.path.read_text(encoding="utf-8") if spec.path.exists() else ""
            datasets.append(
                {
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
            )
        return datasets

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

    def train(
        self,
        request: TrainingRequestData,
        progress_callback: Callable[[dict], None] | None = None,
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

        before_sample = generate_sample(
            model=model,
            tokenizer=tokenizer,
            prompt=request.sample_prompt,
            device=device,
            context_size=model_config.context_length,
            max_new_tokens=24,
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
            seed=model_config.seed,
        )
        if dataset.training_objective == "instruction-sft":
            training_summary = train_instruction_language_model(
                model=model,
                tokenizer=tokenizer,
                entries=json.loads(dataset.path.read_text(encoding="utf-8")),
                device=device,
                config=training_config,
                progress_callback=progress_callback,
            )
        else:
            training_summary = train_tiny_language_model(
                model=model,
                tokenizer=tokenizer,
                text=dataset.path.read_text(encoding="utf-8"),
                device=device,
                config=training_config,
                progress_callback=progress_callback,
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
        training_summary["comparison_prompt"] = request.sample_prompt
        training_summary["dataset_probe_prompt"] = dataset.dataset_probe_prompt

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
        if dataset.source_url is None:
            raise FileNotFoundError(f"Dataset file not found: {dataset.path}")

        dataset.path.parent.mkdir(parents=True, exist_ok=True)
        response = requests.get(dataset.source_url, timeout=60)
        response.raise_for_status()
        dataset.path.write_text(response.text, encoding="utf-8")

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
            "loaded_model_id": loaded_model["model_id"] if loaded_model else None,
            "max_steps": training_summary.get("max_steps"),
            "batch_size": training_summary.get("batch_size"),
            "block_size": training_summary.get("block_size"),
            "learning_rate": training_summary.get("learning_rate"),
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


def _preview_text(text: str, limit: int = 220) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3] + "..."
