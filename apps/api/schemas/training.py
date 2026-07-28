"""Request models for training and the dataset builder.

Extracted verbatim from main.py in Phase 5. Class names are part of the public
OpenAPI surface (they become component schema names), so they must not change.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TrainingRequest(BaseModel):
    dataset_id: str = "every-effort"
    base_model_id: str = "random-tiny-byte"
    output_model_id: str = "trained-tiny-byte"
    max_steps: int = Field(80, ge=1, le=2_000)
    batch_size: int = Field(4, ge=1, le=64)
    block_size: int = Field(32, ge=2, le=1024)
    learning_rate: float = Field(3e-3, gt=0.0, le=1.0)
    eval_every: int = Field(10, ge=1, le=500)
    sample_prompt: str = Field("Every effort moves you", min_length=1)
    load_when_complete: bool = True


class DatasetBuilderExampleRequest(BaseModel):
    instruction: str = Field(..., min_length=1, max_length=2_000)
    input: str = Field("", max_length=4_000)
    output: str = Field(..., min_length=1, max_length=4_000)
    split: Literal["train", "eval"] = "train"
