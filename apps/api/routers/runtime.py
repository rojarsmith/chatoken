"""Runtime, models, checkpoints, and pretrained weights — Stages 02, 07, 08."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.services import device_service
from apps.api.dependencies import (
    chat_service,
    pretrained_jobs,
    pretrained_service,
    runtime_info,
)
from apps.api.schemas import (
    DevicePreferenceRequest,
    ModelLoadRequest,
    PretrainedLoadRequest,
)

router = APIRouter(tags=["runtime"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", **runtime_info()}


@router.get("/models", tags=["stage:02-forward-pass"])
def list_models() -> list[dict]:
    return chat_service.list_models()


# ---------------------------------------------------------------- device

@router.get("/runtime/device")
def get_runtime_device() -> dict:
    return device_service.describe()


@router.post("/runtime/device")
def set_runtime_device(request: DevicePreferenceRequest) -> dict:
    """Switch between GPU and CPU without restarting the API.

    Already-loaded models are moved too, otherwise the next request would still
    run on the device they were loaded onto.
    """
    try:
        device_service.set_preference(request.preference)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    moved = chat_service.move_loaded_models(device_service.resolve())
    return {**device_service.describe(), "moved_models": moved}


# ---------------------------------------------------------------- checkpoints

@router.get("/checkpoints", tags=["stage:07-checkpoints"])
def list_checkpoints() -> list[dict]:
    return chat_service.list_checkpoints()


@router.post("/models/load", tags=["stage:07-checkpoints"])
def load_model(request: ModelLoadRequest) -> dict:
    try:
        return chat_service.load_checkpoint_model(
            checkpoint_id=request.checkpoint_id,
            model_id=request.model_id,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - shape mismatches reach the client
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------- pretrained

@router.get("/pretrained/models", tags=["stage:08-pretrained-gpt2"])
def list_pretrained_models() -> list[dict]:
    return pretrained_service.list_models()


@router.post("/pretrained/jobs", tags=["stage:08-pretrained-gpt2"])
def create_pretrained_job(request: PretrainedLoadRequest) -> dict:
    def work(job_id: str, payload: PretrainedLoadRequest) -> dict:
        def progress(event: dict) -> None:
            # Checked here as well as in the registry so a long download can stop
            # between chunks rather than only at the end.
            if pretrained_jobs.cancel_requested(job_id):
                from concurrent.futures import CancelledError

                raise CancelledError("Pretrained load cancelled.")
            pretrained_jobs.append_progress(job_id, event)

        return pretrained_service.download_and_load(
            model_size=payload.model_size,
            model_id=payload.model_id,
            progress_callback=progress,
        )

    return pretrained_jobs.submit(request, work)


@router.get("/pretrained/jobs/{job_id}", tags=["stage:08-pretrained-gpt2"])
def get_pretrained_job(job_id: str) -> dict:
    job = pretrained_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=pretrained_jobs.not_found_detail)
    return job


@router.post("/pretrained/jobs/{job_id}/cancel", tags=["stage:16-streaming-cancel"])
def cancel_pretrained_job(job_id: str) -> dict:
    job = pretrained_jobs.cancel(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=pretrained_jobs.not_found_detail)
    return job
