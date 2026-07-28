"""Training jobs, datasets, the dataset builder, and experiments — Stages 04-06, 13, 14."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.converters import to_training_request_data
from apps.api.dependencies import training_jobs, training_service
from apps.api.schemas import DatasetBuilderExampleRequest, TrainingRequest

router = APIRouter(tags=["stage:04-training-loop"])


# ---------------------------------------------------------------- datasets

@router.get("/training/datasets", tags=["stage:06-data-scale"])
def list_training_datasets() -> list[dict]:
    return training_service.list_datasets()


@router.post("/training/datasets/{dataset_id}/prepare", tags=["stage:06-data-scale"])
def prepare_training_dataset(dataset_id: str) -> dict:
    try:
        return training_service.prepare_dataset(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - download failures reach the client
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------- dataset builder

@router.get("/training/dataset-builder", tags=["stage:13-your-own-dataset"])
def get_training_dataset_builder() -> dict:
    try:
        return training_service.get_builder_dataset()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/training/dataset-builder/seed", tags=["stage:13-your-own-dataset"])
def seed_training_dataset_builder() -> dict:
    try:
        return training_service.seed_builder_dataset()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/training/dataset-builder/examples", tags=["stage:13-your-own-dataset"])
def create_training_dataset_builder_example(request: DatasetBuilderExampleRequest) -> dict:
    try:
        return training_service.create_builder_example(request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/training/dataset-builder/examples/{example_id}", tags=["stage:13-your-own-dataset"])
def update_training_dataset_builder_example(
    example_id: str, request: DatasetBuilderExampleRequest
) -> dict:
    try:
        return training_service.update_builder_example(example_id, request.model_dump())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/training/dataset-builder/examples/{example_id}", tags=["stage:13-your-own-dataset"])
def delete_training_dataset_builder_example(example_id: str) -> dict:
    try:
        return training_service.delete_builder_example(example_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------- experiments

@router.get("/training/experiments", tags=["stage:14-compare-runs"])
def list_training_experiments() -> list[dict]:
    return training_service.list_experiments()


@router.get("/training/experiments/compare", tags=["stage:14-compare-runs"])
def compare_training_experiments(left_id: str, right_id: str) -> dict:
    try:
        return training_service.compare_experiments(left_id, right_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------- jobs

@router.post("/training/jobs")
def create_training_job(request: TrainingRequest) -> dict:
    def work(job_id: str, payload: TrainingRequest) -> dict:
        return training_service.train(
            to_training_request_data(payload, job_id=job_id),
            progress_callback=lambda event: training_jobs.append_progress(job_id, event),
            should_cancel=lambda: training_jobs.cancel_requested(job_id),
        )

    return training_jobs.submit(request, work)


@router.get("/training/jobs/{job_id}")
def get_training_job(job_id: str) -> dict:
    job = training_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=training_jobs.not_found_detail)
    return job


@router.post("/training/jobs/{job_id}/cancel", tags=["stage:16-streaming-cancel"])
def cancel_training_job(job_id: str) -> dict:
    job = training_jobs.cancel(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=training_jobs.not_found_detail)
    return job
