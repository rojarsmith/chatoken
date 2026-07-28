"""Request models for the resource estimator (Stage 17).

Extracted verbatim from main.py in Phase 5. Class names are part of the public
OpenAPI surface (they become component schema names), so they must not change.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ResourceEstimateRequest(BaseModel):
    model_id: str = "random-tiny-byte"
    prompt_tokens: int = Field(32, ge=0, le=8_192)
    max_new_tokens: int = Field(64, ge=1, le=2_000)
    concurrent_requests: int = Field(1, ge=1, le=64)
    precision: Literal["fp32", "fp16", "int8"] = "fp32"
    include_training: bool = False
    batch_size: int = Field(4, ge=1, le=64)
    block_size: int = Field(32, ge=2, le=1_024)
