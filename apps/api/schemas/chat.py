"""Request and response models for generation endpoints.

Extracted verbatim from main.py in Phase 5. Class names are part of the public
OpenAPI surface (they become component schema names), so they must not change.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    model_id: str = "random-tiny-byte"
    max_new_tokens: int = Field(32, ge=1, le=200)
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    top_k: int | None = Field(None, ge=1, le=200)
    include_prompt: bool = False
    prompt_style: Literal[
        "model-default",
        "raw",
        "chat",
        "instruction",
        "custom",
    ] = "model-default"
    prompt_template: str | None = Field(None, max_length=4_000)
    inference_mode: Literal["manual", "greedy", "focused", "creative"] = "manual"


class ChatResponse(BaseModel):
    model_id: str
    prompt: str
    reply: str
    full_text: str
    prompt_tokens: int
    tokens_generated: int
    prompt_style: str | None = None
    inference_mode: str | None = None
    temperature: float | None = None
    top_k: int | None = None
