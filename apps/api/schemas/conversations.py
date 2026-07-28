"""Request models for multi-turn sessions (Stage 15).

Extracted verbatim from main.py in Phase 5. Class names are part of the public
OpenAPI surface (they become component schema names), so they must not change.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ConversationCreateRequest(BaseModel):
    title: str = Field("New conversation", min_length=1, max_length=120)
    model_id: str = "random-tiny-byte"
    system_prompt: str = Field(
        "You are a concise assistant.",
        max_length=2_000,
    )
    max_history_messages: int = Field(8, ge=1, le=40)
    context_token_budget: int = Field(256, ge=1, le=8_192)
    context_format: Literal["chat-transcript", "instruction-request"] = "chat-transcript"
    max_new_tokens: int = Field(32, ge=1, le=200)
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    top_k: int | None = Field(None, ge=1, le=200)
    inference_mode: Literal["manual", "greedy", "focused", "creative"] = "manual"


class ConversationTurnRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4_000)
    model_id: str = "random-tiny-byte"
    system_prompt: str = Field(
        "You are a concise assistant.",
        max_length=2_000,
    )
    max_history_messages: int = Field(8, ge=1, le=40)
    context_token_budget: int = Field(256, ge=1, le=8_192)
    context_format: Literal["chat-transcript", "instruction-request"] = "chat-transcript"
    max_new_tokens: int = Field(32, ge=1, le=200)
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    top_k: int | None = Field(None, ge=1, le=200)
    inference_mode: Literal["manual", "greedy", "focused", "creative"] = "manual"
    update_settings: bool = True
