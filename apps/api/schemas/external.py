"""Request models for hosted providers (optional track).

Extracted verbatim from main.py in Phase 5. Class names are part of the public
OpenAPI surface (they become component schema names), so they must not change.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ExternalChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    provider: Literal["openai-compatible", "ollama"] = "openai-compatible"
    model_id: str = "openai-compatible"
    system_prompt: str = Field(
        "You are a concise assistant.",
        max_length=2_000,
    )
    max_new_tokens: int = Field(128, ge=1, le=2_000)
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    top_k: int | None = Field(None, ge=1, le=200)
    prompt_style: Literal[
        "model-default",
        "raw",
        "chat",
        "instruction",
        "custom",
    ] = "chat"
    prompt_template: str | None = Field(None, max_length=4_000)
    inference_mode: Literal["manual", "greedy", "focused", "creative"] = "manual"
