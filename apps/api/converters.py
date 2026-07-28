"""Translate pydantic request models into the plain dataclasses services take.

The service layer deliberately knows nothing about FastAPI or pydantic — that is
what lets `llm_core` and the services be driven from a script with no server
running. These functions are the only place the two vocabularies meet.
"""

from __future__ import annotations

from apps.api.schemas import (
    ChatRequest,
    ConversationCreateRequest,
    ConversationTurnRequest,
    ExternalChatRequest,
    ResourceEstimateRequest,
    TrainingRequest,
)
from apps.api.services.chat_service import ChatRequestData
from apps.api.services.conversation_service import (
    ConversationCreateRequestData,
    ConversationTurnRequestData,
)
from apps.api.services.deployment_service import ResourceEstimateRequestData
from apps.api.services.external_model_service import ExternalChatRequestData
from apps.api.services.training_service import TrainingRequestData


def to_chat_request_data(request: ChatRequest) -> ChatRequestData:
    return ChatRequestData(
        message=request.message,
        model_id=request.model_id,
        max_new_tokens=request.max_new_tokens,
        temperature=request.temperature,
        top_k=request.top_k,
        include_prompt=request.include_prompt,
        prompt_style=request.prompt_style,
        prompt_template=request.prompt_template,
        inference_mode=request.inference_mode,
    )


def to_external_request_data(request: ExternalChatRequest) -> ExternalChatRequestData:
    return ExternalChatRequestData(
        message=request.message,
        provider=request.provider,
        model_id=request.model_id,
        system_prompt=request.system_prompt,
        max_new_tokens=request.max_new_tokens,
        temperature=request.temperature,
        top_k=request.top_k,
        prompt_style=request.prompt_style,
        prompt_template=request.prompt_template,
        inference_mode=request.inference_mode,
    )


def to_resource_estimate_request_data(
    request: ResourceEstimateRequest,
) -> ResourceEstimateRequestData:
    return ResourceEstimateRequestData(
        model_id=request.model_id,
        prompt_tokens=request.prompt_tokens,
        max_new_tokens=request.max_new_tokens,
        concurrent_requests=request.concurrent_requests,
        precision=request.precision,
        include_training=request.include_training,
        batch_size=request.batch_size,
        block_size=request.block_size,
    )


def to_conversation_create_request_data(
    request: ConversationCreateRequest,
) -> ConversationCreateRequestData:
    return ConversationCreateRequestData(
        title=request.title,
        model_id=request.model_id,
        system_prompt=request.system_prompt,
        max_history_messages=request.max_history_messages,
        context_token_budget=request.context_token_budget,
        context_format=request.context_format,
        max_new_tokens=request.max_new_tokens,
        temperature=request.temperature,
        top_k=request.top_k,
        inference_mode=request.inference_mode,
    )


def to_conversation_turn_request_data(
    request: ConversationTurnRequest,
) -> ConversationTurnRequestData:
    return ConversationTurnRequestData(
        message=request.message,
        model_id=request.model_id,
        system_prompt=request.system_prompt,
        max_history_messages=request.max_history_messages,
        context_token_budget=request.context_token_budget,
        context_format=request.context_format,
        max_new_tokens=request.max_new_tokens,
        temperature=request.temperature,
        top_k=request.top_k,
        inference_mode=request.inference_mode,
        update_settings=request.update_settings,
    )


def to_training_request_data(
    request: TrainingRequest, job_id: str | None = None
) -> TrainingRequestData:
    return TrainingRequestData(
        dataset_id=request.dataset_id,
        base_model_id=request.base_model_id,
        output_model_id=request.output_model_id,
        max_steps=request.max_steps,
        batch_size=request.batch_size,
        block_size=request.block_size,
        learning_rate=request.learning_rate,
        eval_every=request.eval_every,
        sample_prompt=request.sample_prompt,
        load_when_complete=request.load_when_complete,
        job_id=job_id,
    )
