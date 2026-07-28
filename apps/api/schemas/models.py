"""Request models for loading local and pretrained models.

Extracted verbatim from main.py in Phase 5. Class names are part of the public
OpenAPI surface (they become component schema names), so they must not change.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PretrainedLoadRequest(BaseModel):
    model_size: str = "124M"
    model_id: str | None = None


class ModelLoadRequest(BaseModel):
    checkpoint_id: str
    model_id: str | None = None
