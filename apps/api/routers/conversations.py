"""Multi-turn sessions — Stage 15.

Sessions live in process memory: restarting the API clears them. That is the
point of the stage, not a limitation to work around.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.converters import (
    to_conversation_create_request_data,
    to_conversation_turn_request_data,
)
from apps.api.dependencies import conversation_service
from apps.api.schemas import ConversationCreateRequest, ConversationTurnRequest

router = APIRouter(tags=["stage:15-conversation-memory"])


@router.get("/conversations")
def list_conversations() -> list[dict]:
    return conversation_service.list_conversations()


@router.post("/conversations")
def create_conversation(request: ConversationCreateRequest) -> dict:
    try:
        return conversation_service.create_conversation(
            to_conversation_create_request_data(request)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str) -> dict:
    try:
        return conversation_service.get_conversation(conversation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str) -> dict:
    try:
        return conversation_service.delete_conversation(conversation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/conversations/{conversation_id}/context-preview")
def preview_conversation_context(
    conversation_id: str, request: ConversationTurnRequest
) -> dict:
    try:
        return conversation_service.preview_context(
            conversation_id, to_conversation_turn_request_data(request)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/conversations/{conversation_id}/messages")
def send_conversation_message(
    conversation_id: str, request: ConversationTurnRequest
) -> dict:
    try:
        return conversation_service.send_message(
            conversation_id, to_conversation_turn_request_data(request)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
