"""Pin the observable API contract.

Every assertion here is a promise the web console already depends on. The Phase 5
refactor splits main.py into routers without changing any of it, so this file
must pass identically before and after.
"""

from __future__ import annotations

from tests.conftest import wait_for_job


# ---------------------------------------------------------------- runtime

def test_health_reports_runtime(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    for key in ("torch_version", "device", "cuda_available", "device_count"):
        assert key in body
    assert body["device"] in {"cpu", "cuda"}


def test_models_lists_the_tiny_model(client):
    models = client.get("/models").json()
    assert isinstance(models, list)
    tiny = next(m for m in models if m["model_id"] == "random-tiny-byte")
    assert tiny["tokenizer"] == "byte"
    assert tiny["context_length"] == 64
    assert tiny["parameters"] == 136_704
    assert tiny["prompt_style"] == "chat"


# ---------------------------------------------------------------- chat

def test_chat_is_deterministic_at_temperature_zero(client):
    payload = {"message": "Every effort moves you", "model_id": "random-tiny-byte",
               "max_new_tokens": 8, "temperature": 0}
    first = client.post("/chat", json=payload).json()
    second = client.post("/chat", json=payload).json()

    assert first["model_id"] == "random-tiny-byte"
    assert first["prompt_tokens"] > 0
    assert first["tokens_generated"] <= 8
    assert first["reply"] == second["reply"], "greedy decoding must be reproducible"


def test_prompt_preview_counts_template_tokens(client):
    raw = client.post("/chat/prompt-preview", json={
        "message": "Every effort moves you", "model_id": "random-tiny-byte", "prompt_style": "raw"}).json()
    chat = client.post("/chat/prompt-preview", json={
        "message": "Every effort moves you", "model_id": "random-tiny-byte", "prompt_style": "chat"}).json()

    assert raw["prompt_tokens"] == 22, "one byte per character for plain ASCII"
    assert chat["prompt_tokens"] == 39, "the chat template adds 17 tokens"
    assert chat["context_length"] == 64
    assert chat["effective_prompt_style"] == "chat"
    assert "prompt" in chat and chat["prompt"].startswith("User:")


def test_chat_stream_emits_start_token_done(client):
    with client.stream("POST", "/chat/stream", json={
        "model_id": "random-tiny-byte", "message": "Every effort moves you",
        "max_new_tokens": 5, "temperature": 0}) as response:
        assert response.status_code == 200
        import json as _json
        events = [_json.loads(line) for line in response.iter_lines() if line.strip()]

    assert events[0]["event"] == "start"
    assert events[0]["prompt_tokens"] > 0
    assert events[-1]["event"] == "done"
    assert any(e["event"] == "token" for e in events)


def test_chat_job_lifecycle(client):
    created = client.post("/chat/jobs", json={
        "message": "Every effort moves you", "model_id": "random-tiny-byte", "max_new_tokens": 4}).json()
    assert created["status"] in {"queued", "running"}

    job = wait_for_job(client, f"/chat/jobs/{created['job_id']}")
    assert job["status"] == "succeeded"
    assert job["result"]["reply"] is not None


def test_unknown_job_is_404(client):
    assert client.get("/chat/jobs/does-not-exist").status_code == 404
    assert client.get("/training/jobs/does-not-exist").status_code == 404
    assert client.get("/pretrained/jobs/does-not-exist").status_code == 404


def test_request_validation_ranges(client):
    too_many = client.post("/chat", json={"message": "x", "max_new_tokens": 5000})
    assert too_many.status_code == 422
    too_hot = client.post("/chat", json={"message": "x", "temperature": 9})
    assert too_hot.status_code == 422


# ---------------------------------------------------------------- training

def test_training_datasets_expose_the_ladder(client):
    datasets = {d["dataset_id"]: d for d in client.get("/training/datasets").json()}
    for rung in ("every-effort", "every-effort-expanded", "learning-dialogues", "the-verdict"):
        assert rung in datasets

    tiny = datasets["every-effort"]
    assert tiny["recommended_steps"] == 80
    assert tiny["recommended_base_model_id"] == "random-tiny-byte"
    assert tiny["byte_tokens"] > 0


def test_training_job_produces_a_checkpoint_and_experiment(client, preserve_artifacts):
    created = client.post("/training/jobs", json={
        "dataset_id": "every-effort", "base_model_id": "random-tiny-byte",
        "output_model_id": "pytest-tiny", "max_steps": 2, "eval_every": 1,
        "load_when_complete": False}).json()

    job = wait_for_job(client, f"/training/jobs/{created['job_id']}")
    assert job["status"] == "succeeded", job.get("error")

    summary = job["result"]["training_summary"]
    assert summary["final_loss"] is not None
    assert summary["tokens_seen"] == summary["batch_size"] * summary["block_size"] * 2
    assert summary["tuning_method"] == "full"
    assert summary["before_sample"] is not None
    assert summary["sample_text"] is not None

    checkpoint = job["result"]["checkpoint"]
    assert checkpoint["base_model_id"] == "random-tiny-byte"
    assert checkpoint["tokenizer"] == "byte"
    assert checkpoint["run_config"]["dataset_id"] == "every-effort"

    assert job["progress"], "training must stream loss events"
    assert job["progress"][0]["step"] == 1


def test_unknown_dataset_is_rejected(client):
    created = client.post("/training/jobs", json={
        "dataset_id": "no-such-dataset", "base_model_id": "random-tiny-byte",
        "output_model_id": "pytest-nope", "max_steps": 1}).json()
    job = wait_for_job(client, f"/training/jobs/{created['job_id']}")
    assert job["status"] == "failed"
    assert "no-such-dataset" in job["error"]


# ---------------------------------------------------------------- checkpoints

def test_checkpoints_listing_shape(client):
    checkpoints = client.get("/checkpoints").json()
    assert isinstance(checkpoints, list)
    for item in checkpoints:
        for key in ("checkpoint_id", "model_id", "base_model_id", "created_at",
                    "tokenizer", "version_id", "run_config", "metrics"):
            assert key in item


def test_loading_an_unknown_checkpoint_is_an_error(client):
    response = client.post("/models/load", json={"checkpoint_id": "nope", "model_id": "nope"})
    assert response.status_code in {400, 404}


# ---------------------------------------------------------------- conversations

def test_conversation_context_preview_reports_limits(client):
    created = client.post("/conversations", json={
        "title": "pytest", "model_id": "random-tiny-byte", "system_prompt": "You are concise.",
        "max_history_messages": 8, "context_token_budget": 256,
        "context_format": "chat-transcript", "max_new_tokens": 4}).json()
    conversation_id = created["conversation_id"]

    preview = client.post(f"/conversations/{conversation_id}/context-preview", json={
        "message": "What is my name?", "model_id": "random-tiny-byte",
        "context_format": "chat-transcript", "max_new_tokens": 4}).json()

    assert preview["prompt_tokens"] > 0
    assert preview["model_context_length"] == 64
    assert preview["context_token_budget"] == 256
    assert "omitted_by_history" in preview and "omitted_by_token_budget" in preview
    assert preview["prompt"].startswith("System:")

    assert client.delete(f"/conversations/{conversation_id}").json()["deleted"] is True
    assert client.get(f"/conversations/{conversation_id}").status_code == 404


# ---------------------------------------------------------------- deployment

def test_deployment_estimate_grows_quadratically_with_context(client):
    def estimate(prompt_tokens, max_new_tokens):
        return client.post("/deployment/estimate", json={
            "model_id": "random-tiny-byte", "prompt_tokens": prompt_tokens,
            "max_new_tokens": max_new_tokens, "concurrent_requests": 1,
            "precision": "fp32", "include_training": False}).json()

    # Both sides must stay inside the model's 64-token window, or the estimator
    # clamps them to the same effective context and the growth disappears.
    base = estimate(16, 16)
    doubled = estimate(32, 32)
    assert base["request"]["effective_context_tokens"] == 32
    assert doubled["request"]["effective_context_tokens"] == 64

    assert base["inference"]["parameter_bytes"] == doubled["inference"]["parameter_bytes"], \
        "weights are paid once, regardless of context"
    assert doubled["inference"]["kv_cache_like_bytes"] == 2 * base["inference"]["kv_cache_like_bytes"]
    assert doubled["inference"]["attention_scratch_bytes"] == 4 * base["inference"]["attention_scratch_bytes"], \
        "attention scratch grows with context squared"


def test_deployment_profile_publishes_limits(client):
    profile = client.get("/deployment/profile").json()
    assert profile["limits"]["chat_max_new_tokens"] == 200
    assert profile["limits"]["training_max_steps"] == 2_000
    assert profile["server"]["training_executor_workers"] == 1


# ---------------------------------------------------------------- dataset builder

def test_dataset_builder_crud(client, preserve_artifacts):
    before = {e["example_id"] for e in client.get("/training/dataset-builder").json()["examples"]}

    # The create endpoint answers with the dataset metadata, not the new row,
    # so the example is identified by diffing the listing.
    client.post("/training/dataset-builder/examples", json={
        "instruction": "pytest instruction", "input": "", "output": "pytest output",
        "split": "train"})

    listing = client.get("/training/dataset-builder").json()["examples"]
    added = [e for e in listing if e["example_id"] not in before]
    assert len(added) == 1
    example = added[0]
    assert example["instruction"] == "pytest instruction"
    assert example["split"] == "train"

    client.delete(f"/training/dataset-builder/examples/{example['example_id']}")
    after = {e["example_id"] for e in client.get("/training/dataset-builder").json()["examples"]}
    assert example["example_id"] not in after
    assert after == before


# ---------------------------------------------------------------- external

def test_external_models_never_leak_credentials(client):
    models = client.get("/external/models").json()
    assert {m["provider"] for m in models} == {"openai-compatible", "ollama"}

    allowed = {"model_id", "provider", "provider_model_name", "label",
               "description", "state", "requires_api_key", "base_url"}
    for model in models:
        assert set(model) <= allowed, f"unexpected field exposed: {set(model) - allowed}"
        # requires_api_key advertises that a key is needed; it never carries one.
        assert isinstance(model["requires_api_key"], bool)
        for key, value in model.items():
            if isinstance(value, str):
                assert not value.lower().startswith(("sk-", "bearer ")), f"{key} looks like a credential"
