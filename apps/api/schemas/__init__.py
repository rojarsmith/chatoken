"""Pydantic models for the API, grouped by domain."""

from apps.api.schemas.chat import ChatRequest, ChatResponse
from apps.api.schemas.conversations import (
    ConversationCreateRequest,
    ConversationTurnRequest,
)
from apps.api.schemas.deployment import ResourceEstimateRequest
from apps.api.schemas.external import ExternalChatRequest
from apps.api.schemas.models import ModelLoadRequest, PretrainedLoadRequest
from apps.api.schemas.runtime import DevicePreferenceRequest
from apps.api.schemas.training import DatasetBuilderExampleRequest, TrainingRequest

__all__ = [
    "ChatRequest",
    "DevicePreferenceRequest",
    "ChatResponse",
    "ConversationCreateRequest",
    "ConversationTurnRequest",
    "DatasetBuilderExampleRequest",
    "ExternalChatRequest",
    "ModelLoadRequest",
    "PretrainedLoadRequest",
    "ResourceEstimateRequest",
    "TrainingRequest",
]
