from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch

from llm_core.configs import ModelConfig


def default_checkpoints_dir(project_root: Path | str | None = None) -> Path:
    root = Path(project_root) if project_root is not None else Path.cwd()
    return root / "models" / "checkpoints"


def save_checkpoint(
    *,
    checkpoint_dir: Path,
    model: torch.nn.Module,
    model_id: str,
    base_model_id: str,
    model_config: ModelConfig,
    tokenizer_name: str,
    training_summary: dict[str, Any],
) -> dict[str, Any]:
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    created_at = datetime.now(timezone.utc).isoformat()
    checkpoint_id = _checkpoint_id(model_id, created_at)
    checkpoint_path = checkpoint_dir / f"{checkpoint_id}.pt"
    version = _build_version_metadata(
        checkpoint_id=checkpoint_id,
        model_id=model_id,
        base_model_id=base_model_id,
        created_at=created_at,
        training_summary=training_summary,
    )

    payload = {
        "checkpoint_id": checkpoint_id,
        "model_id": model_id,
        "base_model_id": base_model_id,
        "created_at": created_at,
        "version": version,
        "model_config": asdict(model_config),
        "tokenizer": tokenizer_name,
        "training_summary": training_summary,
        "state_dict": model.state_dict(),
    }
    torch.save(payload, checkpoint_path)
    return checkpoint_metadata(checkpoint_path, payload)


def load_checkpoint(checkpoint_path: Path, map_location: str | torch.device = "cpu") -> dict[str, Any]:
    return torch.load(checkpoint_path, map_location=map_location)


def list_checkpoints(checkpoint_dir: Path) -> list[dict[str, Any]]:
    if not checkpoint_dir.exists():
        return []

    checkpoints: list[dict[str, Any]] = []
    for checkpoint_path in sorted(checkpoint_dir.glob("*.pt"), reverse=True):
        payload = torch.load(checkpoint_path, map_location="cpu")
        checkpoints.append(checkpoint_metadata(checkpoint_path, payload))
    return checkpoints


def find_checkpoint(checkpoint_dir: Path, checkpoint_id: str) -> Path:
    checkpoint_path = checkpoint_dir / f"{checkpoint_id}.pt"
    if checkpoint_path.exists():
        return checkpoint_path
    raise FileNotFoundError(f"Checkpoint not found: {checkpoint_id}")


def checkpoint_metadata(checkpoint_path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    training_summary = payload.get("training_summary", {})
    version = payload.get("version") or _build_version_metadata(
        checkpoint_id=payload["checkpoint_id"],
        model_id=payload["model_id"],
        base_model_id=payload["base_model_id"],
        created_at=payload["created_at"],
        training_summary=training_summary,
    )
    return {
        "checkpoint_id": payload["checkpoint_id"],
        "model_id": payload["model_id"],
        "base_model_id": payload["base_model_id"],
        "created_at": payload["created_at"],
        "path": str(checkpoint_path),
        "size_bytes": checkpoint_path.stat().st_size if checkpoint_path.exists() else None,
        "tokenizer": payload.get("tokenizer", "byte"),
        "version": version,
        "version_id": version["version_id"],
        "version_label": version["label"],
        "lineage": version["lineage"],
        "run_config": version["run_config"],
        "metrics": version["metrics"],
        "training_summary": training_summary,
    }


def _checkpoint_id(model_id: str, created_at: str) -> str:
    safe_model_id = "".join(ch if ch.isalnum() or ch in ("-", "_") else "-" for ch in model_id)
    timestamp = (
        created_at.replace("-", "")
        .replace(":", "")
        .replace(".", "")
        .replace("+", "z")
    )
    return f"{safe_model_id}-{timestamp}"


def _build_version_metadata(
    *,
    checkpoint_id: str,
    model_id: str,
    base_model_id: str,
    created_at: str,
    training_summary: dict[str, Any],
) -> dict[str, Any]:
    run_config = _run_config(training_summary)
    metrics = _checkpoint_metrics(training_summary)
    version_source = {
        "checkpoint_id": checkpoint_id,
        "model_id": model_id,
        "base_model_id": base_model_id,
        "created_at": created_at,
        "run_config": run_config,
        "metrics": metrics,
    }
    version_id = hashlib.sha1(
        json.dumps(version_source, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()[:12]
    return {
        "version_id": version_id,
        "label": f"{model_id}@{version_id[:7]}",
        "created_at": created_at,
        "lineage": {
            "parent_model_id": base_model_id,
            "model_id": model_id,
            "checkpoint_id": checkpoint_id,
        },
        "run_config": run_config,
        "metrics": metrics,
    }


def _run_config(training_summary: dict[str, Any]) -> dict[str, Any]:
    return {
        "dataset_id": training_summary.get("dataset_id"),
        "dataset_label": training_summary.get("dataset_label"),
        "dataset_tier": training_summary.get("dataset_tier"),
        "training_objective": training_summary.get("training_objective"),
        "prompt_style": training_summary.get("prompt_style"),
        "learning_stage": training_summary.get("learning_stage"),
        "tuning_method": training_summary.get("tuning_method"),
        "max_steps": training_summary.get("max_steps"),
        "batch_size": training_summary.get("batch_size"),
        "block_size": training_summary.get("block_size"),
        "learning_rate": training_summary.get("learning_rate"),
        "eval_every": training_summary.get("eval_every"),
        "seed": training_summary.get("seed"),
    }


def _checkpoint_metrics(training_summary: dict[str, Any]) -> dict[str, Any]:
    return {
        "final_loss": training_summary.get("final_loss"),
        "tokens_seen": training_summary.get("tokens_seen"),
        "dataset_tokens": training_summary.get("dataset_tokens"),
        "trainable_parameters": training_summary.get("trainable_parameters"),
        "total_parameters": training_summary.get("total_parameters"),
        "trainable_percent": training_summary.get("trainable_percent"),
        "examples_used_for_training": training_summary.get(
            "examples_used_for_training"
        ),
        "train_examples": training_summary.get("train_examples"),
        "eval_examples": training_summary.get("eval_examples"),
    }
