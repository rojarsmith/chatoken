"""Guard the job payload shape that the three merged job systems used to define separately.

The OpenAPI surface cannot catch these: job endpoints are annotated `-> dict`,
so the schema says nothing about their fields. Before Phase 5 the difference
between the three payloads was implicit in three dataclasses; now it is one flag
on JobRegistry, and these tests are what keeps it honest.
"""

from __future__ import annotations

from tests.conftest import wait_for_job


JOB_FIELDS = {"job_id", "status", "created_at", "updated_at", "request",
              "result", "error", "cancel_requested"}


def test_chat_jobs_have_no_progress_list(client):
    created = client.post("/chat/jobs", json={
        "message": "Every effort moves you", "model_id": "random-tiny-byte",
        "max_new_tokens": 2}).json()

    assert set(created) == JOB_FIELDS, "chat jobs never reported progress events"
    assert "progress" not in created

    finished = wait_for_job(client, f"/chat/jobs/{created['job_id']}")
    assert "progress" not in finished


def test_training_and_pretrained_jobs_do_have_progress(client):
    training = client.post("/training/jobs", json={
        "dataset_id": "every-effort", "base_model_id": "random-tiny-byte",
        "output_model_id": "pytest-shape", "max_steps": 1,
        "load_when_complete": False}).json()
    assert set(training) == JOB_FIELDS | {"progress"}
    assert training["progress"] == []
    client.post(f"/training/jobs/{training['job_id']}/cancel")

    pretrained = client.post("/pretrained/jobs", json={"model_size": "124M"}).json()
    assert set(pretrained) == JOB_FIELDS | {"progress"}
    client.post(f"/pretrained/jobs/{pretrained['job_id']}/cancel")


def test_cancelling_a_queued_job_takes_effect_immediately(client, preserve_artifacts):
    # The single worker is what makes this deterministic: with one job already
    # running, the next one is guaranteed to still be queued.
    blocker = client.post("/training/jobs", json={
        "dataset_id": "the-verdict", "base_model_id": "random-tiny-byte",
        "output_model_id": "pytest-blocker", "max_steps": 2000, "block_size": 64,
        "load_when_complete": False}).json()

    queued = client.post("/training/jobs", json={
        "dataset_id": "every-effort", "base_model_id": "random-tiny-byte",
        "output_model_id": "pytest-queued", "max_steps": 1,
        "load_when_complete": False}).json()

    cancelled = client.post(f"/training/jobs/{queued['job_id']}/cancel").json()
    assert cancelled["cancel_requested"] is True
    assert cancelled["status"] == "cancelled", "a queued job never started, so it stops at once"
    assert cancelled["error"] == "Cancelled by user."

    # Clean up the long-running job; a running one stops at its next checkpoint.
    client.post(f"/training/jobs/{blocker['job_id']}/cancel")
    final = wait_for_job(client, f"/training/jobs/{blocker['job_id']}")
    assert final["status"] == "cancelled"


def test_cancelling_an_unknown_job_is_404(client):
    assert client.post("/chat/jobs/nope/cancel").status_code == 404
    assert client.post("/training/jobs/nope/cancel").status_code == 404
    assert client.post("/pretrained/jobs/nope/cancel").status_code == 404
