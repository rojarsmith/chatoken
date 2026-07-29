"""Request models for runtime controls."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class DevicePreferenceRequest(BaseModel):
    preference: Literal["auto", "cuda", "cpu"] = "auto"
