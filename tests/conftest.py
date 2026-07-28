"""Shared fixtures for the API smoke tests.

These tests run against the real application — no mocking of the model layer —
because their job is to pin the observable contract while main.py is split into
routers in Phase 5 of the restructure.

Tests that create artifacts (checkpoints, experiment records, conversations)
restore the on-disk state afterwards, so running the suite never pollutes the
learner's own training history.
"""

from __future__ import annotations

import json
import shutil
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "packages" / "llm_core"))

from fastapi.testclient import TestClient  # noqa: E402

CHECKPOINT_DIR = ROOT / "models" / "checkpoints"
EXPERIMENT_LOG = ROOT / "models" / "experiments" / "training-experiments.jsonl"
BUILDER_DATA = ROOT / "data" / "custom" / "instruction-builder.json"


@pytest.fixture(scope="session")
def client():
    from apps.api.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def preserve_artifacts():
    """Restore checkpoints, the experiment log, and builder data after a test."""
    before_checkpoints = set(CHECKPOINT_DIR.glob("*.pt")) if CHECKPOINT_DIR.exists() else set()
    experiment_backup = EXPERIMENT_LOG.read_text(encoding="utf-8") if EXPERIMENT_LOG.exists() else None
    builder_backup = BUILDER_DATA.read_text(encoding="utf-8") if BUILDER_DATA.exists() else None

    yield

    if CHECKPOINT_DIR.exists():
        for path in CHECKPOINT_DIR.glob("*.pt"):
            if path not in before_checkpoints:
                path.unlink(missing_ok=True)

    if experiment_backup is not None:
        EXPERIMENT_LOG.write_text(experiment_backup, encoding="utf-8")
    elif EXPERIMENT_LOG.exists():
        EXPERIMENT_LOG.unlink()

    if builder_backup is not None:
        BUILDER_DATA.write_text(builder_backup, encoding="utf-8")
    elif BUILDER_DATA.exists():
        BUILDER_DATA.unlink()


def wait_for_job(client, url: str, timeout: float = 120.0) -> dict:
    """Poll a job until it leaves queued/running, or fail with what it was doing."""
    deadline = time.time() + timeout
    job = None
    while time.time() < deadline:
        job = client.get(url).json()
        if job["status"] not in {"queued", "running"}:
            return job
        time.sleep(0.25)
    raise AssertionError(f"job at {url} did not finish in {timeout}s: {job}")
