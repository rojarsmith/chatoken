"""Hosted provider comparison — the optional external-models track.

Provider credentials are read from environment variables by this process and
never travel to the browser. The web app calls these endpoints; only the API
server talks to the provider.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.converters import to_external_request_data
from apps.api.dependencies import external_model_service
from apps.api.schemas import ExternalChatRequest

router = APIRouter(tags=["track:external-models"])


@router.get("/external/models")
def list_external_models() -> list[dict]:
    return external_model_service.list_models()


@router.post("/external/prompt-preview")
def preview_external_prompt(request: ExternalChatRequest) -> dict:
    try:
        return external_model_service.preview_prompt(to_external_request_data(request))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/external/chat")
def external_chat(request: ExternalChatRequest) -> dict:
    try:
        return external_model_service.generate_reply(to_external_request_data(request))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
