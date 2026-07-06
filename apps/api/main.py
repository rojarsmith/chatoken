from __future__ import annotations

import json
from concurrent.futures import CancelledError, ThreadPoolExecutor
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Literal
from uuid import uuid4

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from apps.api.services.chat_service import ChatRequestData, ChatService
from apps.api.services.pretrained_service import PretrainedService
from apps.api.services.training_service import TrainingRequestData, TrainingService


app = FastAPI(
    title="LLM ABC API",
    version="0.1.0",
    description="A minimal educational API for a tiny ChatGPT-like model.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_service = ChatService()
training_service = TrainingService(chat_service)
pretrained_service = PretrainedService(chat_service)
executor = ThreadPoolExecutor(max_workers=1)
chat_jobs_lock = Lock()
training_jobs_lock = Lock()
pretrained_jobs_lock = Lock()


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


class TrainingRequest(BaseModel):
    dataset_id: str = "every-effort"
    base_model_id: str = "random-tiny-byte"
    output_model_id: str = "trained-tiny-byte"
    max_steps: int = Field(80, ge=1, le=2_000)
    batch_size: int = Field(4, ge=1, le=64)
    block_size: int = Field(32, ge=2, le=1024)
    learning_rate: float = Field(3e-3, gt=0.0, le=1.0)
    eval_every: int = Field(10, ge=1, le=500)
    sample_prompt: str = Field("Every effort moves you", min_length=1)
    load_when_complete: bool = True


class PretrainedLoadRequest(BaseModel):
    model_size: str = "124M"
    model_id: str | None = None


class ModelLoadRequest(BaseModel):
    checkpoint_id: str
    model_id: str | None = None


class DatasetBuilderExampleRequest(BaseModel):
    instruction: str = Field(..., min_length=1, max_length=2_000)
    input: str = Field("", max_length=4_000)
    output: str = Field(..., min_length=1, max_length=4_000)
    split: Literal["train", "eval"] = "train"


@dataclass
class ChatJob:
    job_id: str
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    created_at: str
    updated_at: str
    request: dict
    result: dict | None = None
    error: str | None = None
    cancel_requested: bool = False


@dataclass
class TrainingJob:
    job_id: str
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    created_at: str
    updated_at: str
    request: dict
    progress: list[dict]
    result: dict | None = None
    error: str | None = None
    cancel_requested: bool = False


@dataclass
class PretrainedJob:
    job_id: str
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    created_at: str
    updated_at: str
    request: dict
    progress: list[dict]
    result: dict | None = None
    error: str | None = None
    cancel_requested: bool = False


chat_jobs: dict[str, ChatJob] = {}
training_jobs: dict[str, TrainingJob] = {}
pretrained_jobs: dict[str, PretrainedJob] = {}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", **_runtime_info()}


@app.get("/models")
def list_models() -> list[dict]:
    return chat_service.list_models()


@app.get("/pretrained/models")
def list_pretrained_models() -> list[dict]:
    return pretrained_service.list_models()


@app.post("/pretrained/jobs")
def create_pretrained_job(request: PretrainedLoadRequest) -> dict:
    job_id = str(uuid4())
    now = _utc_now()
    job = PretrainedJob(
        job_id=job_id,
        status="queued",
        created_at=now,
        updated_at=now,
        request=request.model_dump(),
        progress=[],
    )
    with pretrained_jobs_lock:
        pretrained_jobs[job_id] = job

    executor.submit(_run_pretrained_job, job_id, request)
    return _job_to_dict(job)


@app.get("/pretrained/jobs/{job_id}")
def get_pretrained_job(job_id: str) -> dict:
    with pretrained_jobs_lock:
        job = pretrained_jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Pretrained job not found")
        return _job_to_dict(job)


@app.post("/pretrained/jobs/{job_id}/cancel")
def cancel_pretrained_job(job_id: str) -> dict:
    return _cancel_pretrained_job(job_id)


@app.post("/models/load")
def load_model(request: ModelLoadRequest) -> dict:
    try:
        return chat_service.load_checkpoint_model(
            checkpoint_id=request.checkpoint_id,
            model_id=request.model_id,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/checkpoints")
def list_checkpoints() -> list[dict]:
    return chat_service.list_checkpoints()


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        result = chat_service.generate_reply(_to_request_data(request))
        return ChatResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/chat/prompt-preview")
def preview_chat_prompt(request: ChatRequest) -> dict:
    try:
        return chat_service.preview_prompt(_to_request_data(request))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/chat/stream")
def stream_chat(request: ChatRequest) -> StreamingResponse:
    def events():
        try:
            for event in chat_service.stream_reply(_to_request_data(request)):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except ValueError as exc:
            yield json.dumps(
                {"event": "error", "error": str(exc)},
                ensure_ascii=False,
            ) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")


@app.post("/chat/jobs")
def create_chat_job(request: ChatRequest) -> dict:
    job_id = str(uuid4())
    now = _utc_now()
    job = ChatJob(
        job_id=job_id,
        status="queued",
        created_at=now,
        updated_at=now,
        request=request.model_dump(),
    )
    with chat_jobs_lock:
        chat_jobs[job_id] = job

    executor.submit(_run_chat_job, job_id, request)
    return _job_to_dict(job)


@app.get("/chat/jobs/{job_id}")
def get_chat_job(job_id: str) -> dict:
    with chat_jobs_lock:
        job = chat_jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Chat job not found")
        return _job_to_dict(job)


@app.post("/chat/jobs/{job_id}/cancel")
def cancel_chat_job(job_id: str) -> dict:
    return _cancel_chat_job(job_id)


@app.get("/training/datasets")
def list_training_datasets() -> list[dict]:
    return training_service.list_datasets()


@app.get("/training/dataset-builder")
def get_training_dataset_builder() -> dict:
    try:
        return training_service.get_builder_dataset()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/training/dataset-builder/seed")
def seed_training_dataset_builder() -> dict:
    try:
        return training_service.seed_builder_dataset()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/training/dataset-builder/examples")
def create_training_dataset_builder_example(
    request: DatasetBuilderExampleRequest,
) -> dict:
    try:
        return training_service.create_builder_example(request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/training/dataset-builder/examples/{example_id}")
def update_training_dataset_builder_example(
    example_id: str,
    request: DatasetBuilderExampleRequest,
) -> dict:
    try:
        return training_service.update_builder_example(
            example_id,
            request.model_dump(),
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/training/dataset-builder/examples/{example_id}")
def delete_training_dataset_builder_example(example_id: str) -> dict:
    try:
        return training_service.delete_builder_example(example_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/training/datasets/{dataset_id}/prepare")
def prepare_training_dataset(dataset_id: str) -> dict:
    try:
        return training_service.prepare_dataset(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/training/experiments")
def list_training_experiments() -> list[dict]:
    return training_service.list_experiments()


@app.get("/training/experiments/compare")
def compare_training_experiments(left_id: str, right_id: str) -> dict:
    try:
        return training_service.compare_experiments(left_id, right_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/training/jobs")
def create_training_job(request: TrainingRequest) -> dict:
    job_id = str(uuid4())
    now = _utc_now()
    job = TrainingJob(
        job_id=job_id,
        status="queued",
        created_at=now,
        updated_at=now,
        request=request.model_dump(),
        progress=[],
    )
    with training_jobs_lock:
        training_jobs[job_id] = job

    executor.submit(_run_training_job, job_id, request)
    return _job_to_dict(job)


@app.get("/training/jobs/{job_id}")
def get_training_job(job_id: str) -> dict:
    with training_jobs_lock:
        job = training_jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Training job not found")
        return _job_to_dict(job)


@app.post("/training/jobs/{job_id}/cancel")
def cancel_training_job(job_id: str) -> dict:
    return _cancel_training_job(job_id)


def _run_chat_job(job_id: str, request: ChatRequest) -> None:
    if _chat_cancel_requested(job_id):
        _update_chat_job(job_id, status="cancelled", error="Cancelled by user.")
        return
    _update_chat_job(job_id, status="running")
    try:
        result = None
        for event in chat_service.stream_reply(
            _to_request_data(request),
            should_cancel=lambda: _chat_cancel_requested(job_id),
        ):
            if event["event"] == "done":
                result = event["result"]
        if result is None:
            raise RuntimeError("Chat generation produced no result.")
        _update_chat_job(job_id, status="succeeded", result=result)
    except CancelledError:
        _update_chat_job(job_id, status="cancelled", error="Cancelled by user.")
    except Exception as exc:  # Keep job failures visible to the UI.
        _update_chat_job(job_id, status="failed", error=str(exc))


def _run_training_job(job_id: str, request: TrainingRequest) -> None:
    if _training_cancel_requested(job_id):
        _update_training_job(job_id, status="cancelled", error="Cancelled by user.")
        return
    _update_training_job(job_id, status="running")
    try:
        result = training_service.train(
            _to_training_request_data(request, job_id=job_id),
            progress_callback=lambda event: _append_training_progress(job_id, event),
            should_cancel=lambda: _training_cancel_requested(job_id),
        )
        _update_training_job(job_id, status="succeeded", result=result)
    except CancelledError:
        _update_training_job(job_id, status="cancelled", error="Cancelled by user.")
    except Exception as exc:
        _update_training_job(job_id, status="failed", error=str(exc))


def _run_pretrained_job(job_id: str, request: PretrainedLoadRequest) -> None:
    if _pretrained_cancel_requested(job_id):
        _update_pretrained_job(job_id, status="cancelled", error="Cancelled by user.")
        return
    _update_pretrained_job(job_id, status="running")
    try:
        def progress(event: dict) -> None:
            if _pretrained_cancel_requested(job_id):
                raise CancelledError("Pretrained load cancelled.")
            _append_pretrained_progress(job_id, event)

        result = pretrained_service.download_and_load(
            model_size=request.model_size,
            model_id=request.model_id,
            progress_callback=progress,
        )
        if _pretrained_cancel_requested(job_id):
            raise CancelledError("Pretrained load cancelled.")
        _update_pretrained_job(job_id, status="succeeded", result=result)
    except CancelledError:
        _update_pretrained_job(job_id, status="cancelled", error="Cancelled by user.")
    except Exception as exc:
        _update_pretrained_job(job_id, status="failed", error=str(exc))


def _update_chat_job(
    job_id: str,
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"],
    result: dict | None = None,
    error: str | None = None,
) -> None:
    with chat_jobs_lock:
        job = chat_jobs[job_id]
        job.status = status
        job.updated_at = _utc_now()
        job.result = result
        job.error = error


def _update_training_job(
    job_id: str,
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"],
    result: dict | None = None,
    error: str | None = None,
) -> None:
    with training_jobs_lock:
        job = training_jobs[job_id]
        job.status = status
        job.updated_at = _utc_now()
        job.result = result
        job.error = error


def _update_pretrained_job(
    job_id: str,
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"],
    result: dict | None = None,
    error: str | None = None,
) -> None:
    with pretrained_jobs_lock:
        job = pretrained_jobs[job_id]
        job.status = status
        job.updated_at = _utc_now()
        job.result = result
        job.error = error


def _cancel_chat_job(job_id: str) -> dict:
    with chat_jobs_lock:
        job = chat_jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Chat job not found")
        job.cancel_requested = True
        job.updated_at = _utc_now()
        if job.status == "queued":
            job.status = "cancelled"
            job.error = "Cancelled by user."
        return _job_to_dict(job)


def _cancel_training_job(job_id: str) -> dict:
    with training_jobs_lock:
        job = training_jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Training job not found")
        job.cancel_requested = True
        job.updated_at = _utc_now()
        if job.status == "queued":
            job.status = "cancelled"
            job.error = "Cancelled by user."
        return _job_to_dict(job)


def _cancel_pretrained_job(job_id: str) -> dict:
    with pretrained_jobs_lock:
        job = pretrained_jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Pretrained job not found")
        job.cancel_requested = True
        job.updated_at = _utc_now()
        if job.status == "queued":
            job.status = "cancelled"
            job.error = "Cancelled by user."
        return _job_to_dict(job)


def _chat_cancel_requested(job_id: str) -> bool:
    with chat_jobs_lock:
        job = chat_jobs.get(job_id)
        return job is None or job.cancel_requested or job.status == "cancelled"


def _training_cancel_requested(job_id: str) -> bool:
    with training_jobs_lock:
        job = training_jobs.get(job_id)
        return job is None or job.cancel_requested or job.status == "cancelled"


def _pretrained_cancel_requested(job_id: str) -> bool:
    with pretrained_jobs_lock:
        job = pretrained_jobs.get(job_id)
        return job is None or job.cancel_requested or job.status == "cancelled"


def _append_training_progress(job_id: str, event: dict) -> None:
    with training_jobs_lock:
        job = training_jobs[job_id]
        if job.status == "cancelled":
            return
        job.progress.append(event)
        job.updated_at = _utc_now()


def _append_pretrained_progress(job_id: str, event: dict) -> None:
    with pretrained_jobs_lock:
        job = pretrained_jobs[job_id]
        if job.status == "cancelled":
            return
        job.progress.append(event)
        job.updated_at = _utc_now()


def _job_to_dict(job: ChatJob) -> dict:
    return asdict(job)


def _to_request_data(request: ChatRequest) -> ChatRequestData:
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


def _to_training_request_data(request: TrainingRequest, job_id: str | None = None) -> TrainingRequestData:
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


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _runtime_info() -> dict:
    cuda_available = torch.cuda.is_available()
    return {
        "torch_version": torch.__version__,
        "device": "cuda" if cuda_available else "cpu",
        "cuda_available": cuda_available,
        "cuda_version": torch.version.cuda,
        "device_count": torch.cuda.device_count(),
        "device_name": torch.cuda.get_device_name(0) if cuda_available else None,
    }
