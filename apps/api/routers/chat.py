"""Generation endpoints — Stages 03, 09, and 16."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from apps.api.converters import to_chat_request_data
from apps.api.dependencies import chat_jobs, chat_service
from apps.api.schemas import ChatRequest, ChatResponse

router = APIRouter(tags=["stage:03-decoding"])


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        result = chat_service.generate_reply(to_chat_request_data(request))
        return ChatResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/chat/prompt-preview", tags=["stage:09-prompt-format"])
def preview_chat_prompt(request: ChatRequest) -> dict:
    try:
        return chat_service.preview_prompt(to_chat_request_data(request))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/chat/stream", tags=["stage:16-streaming-cancel"])
def stream_chat(request: ChatRequest) -> StreamingResponse:
    def events():
        try:
            for event in chat_service.stream_reply(to_chat_request_data(request)):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except ValueError as exc:
            yield json.dumps({"event": "error", "error": str(exc)}, ensure_ascii=False) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")


@router.post("/chat/jobs", tags=["stage:16-streaming-cancel"])
def create_chat_job(request: ChatRequest) -> dict:
    def work(job_id: str, payload: ChatRequest) -> dict:
        # Streamed rather than generate_reply(), because only stream_reply takes
        # a cancellation check — the loop has to be able to stop between tokens.
        result = None
        for event in chat_service.stream_reply(
            to_chat_request_data(payload),
            should_cancel=lambda: chat_jobs.cancel_requested(job_id),
        ):
            if event["event"] == "done":
                result = event["result"]
        if result is None:
            raise RuntimeError("Chat generation produced no result.")
        return result

    return chat_jobs.submit(request, work)


@router.get("/chat/jobs/{job_id}", tags=["stage:16-streaming-cancel"])
def get_chat_job(job_id: str) -> dict:
    job = chat_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=chat_jobs.not_found_detail)
    return job


@router.post("/chat/jobs/{job_id}/cancel", tags=["stage:16-streaming-cancel"])
def cancel_chat_job(job_id: str) -> dict:
    job = chat_jobs.cancel(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=chat_jobs.not_found_detail)
    return job
