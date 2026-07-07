from __future__ import annotations

from dataclasses import dataclass

from apps.api.services.chat_service import ChatService


PRECISION_BYTES = {
    "fp32": 4,
    "fp16": 2,
    "int8": 1,
}


@dataclass(frozen=True)
class ResourceEstimateRequestData:
    model_id: str
    prompt_tokens: int
    max_new_tokens: int
    concurrent_requests: int
    precision: str
    include_training: bool
    batch_size: int
    block_size: int


class DeploymentService:
    def __init__(self, chat_service: ChatService) -> None:
        self._chat_service = chat_service

    def profile(self, runtime_info: dict) -> dict:
        return {
            "runtime": runtime_info,
            "server": {
                "api_framework": "FastAPI / uvicorn",
                "web_framework": "Next.js",
                "training_executor_workers": 1,
                "local_model_generation_lock": "one generation at a time per local model",
                "external_credentials_location": "API server environment variables",
            },
            "limits": {
                "chat_max_new_tokens": 200,
                "external_chat_max_new_tokens": 2_000,
                "training_max_steps": 2_000,
                "training_max_batch_size": 64,
                "training_max_block_size": 1_024,
                "dataset_builder_instruction_max_chars": 2_000,
                "dataset_builder_text_max_chars": 4_000,
            },
            "precision_options": [
                {"id": key, "bytes_per_value": value}
                for key, value in PRECISION_BYTES.items()
            ],
            "models": self._chat_service.list_models(),
            "deployment_modes": [
                {
                    "id": "local-dev",
                    "label": "Local development",
                    "notes": [
                        "Run API and Web UI on the same machine.",
                        "Good for tiny training and UI learning.",
                    ],
                },
                {
                    "id": "split-api-web",
                    "label": "Split API and Web",
                    "notes": [
                        "Serve the Next.js app separately from the Python API.",
                        "Keep provider API keys only on the API server.",
                    ],
                },
                {
                    "id": "gpu-worker",
                    "label": "GPU API worker",
                    "notes": [
                        "Use CUDA for GPT-2 fine-tuning or larger checkpoints.",
                        "Keep CPU as a smoke-test path for small examples.",
                    ],
                },
            ],
        }

    def estimate(self, request: ResourceEstimateRequestData) -> dict:
        model = self._chat_service.model_resource_profile(request.model_id)
        bytes_per_value = PRECISION_BYTES[request.precision]
        requested_context_tokens = request.prompt_tokens + request.max_new_tokens
        effective_context_tokens = min(
            model["context_length"],
            max(1, requested_context_tokens),
        )
        parameter_bytes = model["parameters"] * bytes_per_value

        # This project recomputes the visible context each token. The KV number is
        # shown because production inference servers commonly cache keys/values.
        kv_cache_like_bytes = (
            2
            * model["n_layers"]
            * effective_context_tokens
            * model["emb_dim"]
            * bytes_per_value
            * request.concurrent_requests
        )
        local_context_work_bytes = (
            model["n_layers"]
            * effective_context_tokens
            * model["emb_dim"]
            * 6
            * bytes_per_value
            * request.concurrent_requests
        )
        attention_scratch_bytes = (
            model["n_layers"]
            * model["n_heads"]
            * effective_context_tokens
            * effective_context_tokens
            * bytes_per_value
            * request.concurrent_requests
        )

        inference_total_bytes = (
            parameter_bytes
            + kv_cache_like_bytes
            + local_context_work_bytes
            + attention_scratch_bytes
        )

        train_context_tokens = min(model["context_length"], request.block_size)
        train_activation_bytes = (
            request.batch_size
            * train_context_tokens
            * model["emb_dim"]
            * model["n_layers"]
            * 10
            * bytes_per_value
        )
        adamw_training_state_bytes = model["parameters"] * 16
        training_total_bytes = (
            parameter_bytes + adamw_training_state_bytes + train_activation_bytes
            if request.include_training
            else None
        )

        warnings = []
        if requested_context_tokens > model["context_length"]:
            warnings.append(
                "prompt_tokens + max_new_tokens exceeds context_length; older tokens "
                "will be outside the active context window."
            )
        if request.block_size > model["context_length"]:
            warnings.append(
                "block_size exceeds context_length; training will reject this config."
            )
        if request.concurrent_requests > 1:
            warnings.append(
                "Local model generation uses a per-model lock, so concurrency may be "
                "serialized even if HTTP requests arrive concurrently."
            )
        if request.include_training and model["parameters"] > 100_000_000:
            warnings.append(
                "Large-model training should use a CUDA GPU; CPU is suitable only for "
                "short smoke tests."
            )

        return {
            "model": model,
            "request": {
                "model_id": request.model_id,
                "prompt_tokens": request.prompt_tokens,
                "max_new_tokens": request.max_new_tokens,
                "requested_context_tokens": requested_context_tokens,
                "effective_context_tokens": effective_context_tokens,
                "concurrent_requests": request.concurrent_requests,
                "precision": request.precision,
                "bytes_per_value": bytes_per_value,
                "include_training": request.include_training,
                "batch_size": request.batch_size,
                "block_size": request.block_size,
            },
            "inference": {
                "parameter_bytes": parameter_bytes,
                "kv_cache_like_bytes": kv_cache_like_bytes,
                "local_context_work_bytes": local_context_work_bytes,
                "attention_scratch_bytes": attention_scratch_bytes,
                "total_estimated_bytes": inference_total_bytes,
            },
            "training": {
                "enabled": request.include_training,
                "train_context_tokens": train_context_tokens,
                "adamw_training_state_bytes": adamw_training_state_bytes
                if request.include_training
                else 0,
                "activation_estimate_bytes": train_activation_bytes
                if request.include_training
                else 0,
                "total_estimated_bytes": training_total_bytes,
            },
            "notes": [
                "Estimates are for learning and sizing conversations, not a profiler.",
                "The local implementation recomputes context during generation; KV cache is shown as a production-serving concept.",
                "External-provider resource usage is paid on the provider side, but network latency and request limits still matter.",
            ],
            "warnings": warnings,
        }
