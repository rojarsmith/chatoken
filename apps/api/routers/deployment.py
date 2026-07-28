"""Runtime profile and resource estimates — Stage 17."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.converters import to_resource_estimate_request_data
from apps.api.dependencies import deployment_service, runtime_info
from apps.api.schemas import ResourceEstimateRequest

router = APIRouter(tags=["stage:17-deploy-limits"])


@router.get("/deployment/profile")
def deployment_profile() -> dict:
    return deployment_service.profile(runtime_info())


@router.post("/deployment/estimate")
def deployment_estimate(request: ResourceEstimateRequest) -> dict:
    try:
        return deployment_service.estimate(to_resource_estimate_request_data(request))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
