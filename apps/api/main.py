"""Chatoken API — application assembly only.

Endpoints live in `routers/`, request models in `schemas/`, shared singletons in
`dependencies.py`, and the job lifecycle in `jobs/registry.py`. This file exists
to wire them together and nothing else.

Endpoint paths and response shapes are unchanged from the pre-Phase-5 version;
`scripts/api_surface.py` and `tests/test_api_contract.py` hold that promise.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.routers import (
    chat,
    conversations,
    deployment,
    external,
    runtime,
    training,
)


app = FastAPI(
    title="Chatoken API",
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

# Registration order sets the order of /docs. It follows the course: runtime
# first, then generation, training, alignment, sessions, and deployment.
app.include_router(runtime.router)
app.include_router(chat.router)
app.include_router(training.router)
app.include_router(conversations.router)
app.include_router(deployment.router)
app.include_router(external.router)
