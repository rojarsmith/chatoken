from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from llm_core.generation import prepare_chat_prompt


INFERENCE_MODE_PRESETS = {
    "manual": None,
    "greedy": {"temperature": 0.0, "top_k": None},
    "focused": {"temperature": 0.4, "top_k": 20},
    "creative": {"temperature": 1.0, "top_k": 80},
}


@dataclass(frozen=True)
class ExternalChatRequestData:
    message: str
    provider: str
    model_id: str
    system_prompt: str
    max_new_tokens: int
    temperature: float
    top_k: int | None
    prompt_style: str
    prompt_template: str | None
    inference_mode: str


class ExternalModelService:
    def list_models(self) -> list[dict]:
        return [
            _openai_compatible_model(),
            _ollama_model(),
        ]

    def preview_prompt(self, request: ExternalChatRequestData) -> dict:
        model = _model_for_request(request, self.list_models())
        generation_config = _generation_config(request)
        rendered_prompt, messages = _messages_for_request(request)
        unsupported_settings = []

        if request.provider == "openai-compatible" and generation_config["top_k"] is not None:
            unsupported_settings.append("top_k is not part of the chat/completions request.")

        return {
            "provider": request.provider,
            "model_id": request.model_id,
            "provider_model_name": model.get("provider_model_name"),
            "state": model["state"],
            "prompt_style": _effective_prompt_style(request.prompt_style),
            "inference_mode": request.inference_mode,
            "temperature": generation_config["temperature"],
            "top_k": generation_config["top_k"],
            "max_new_tokens": request.max_new_tokens,
            "prompt": rendered_prompt,
            "messages": messages,
            "estimated_prompt_tokens": _estimate_tokens(rendered_prompt),
            "unsupported_settings": unsupported_settings,
        }

    def generate_reply(self, request: ExternalChatRequestData) -> dict:
        model = _model_for_request(request, self.list_models())
        _ensure_model_ready(model)
        started_at = time.perf_counter()
        preview = self.preview_prompt(request)

        if request.provider == "openai-compatible":
            reply, usage = _call_openai_compatible(model, request, preview["messages"])
        elif request.provider == "ollama":
            reply, usage = _call_ollama(model, request, preview["messages"])
        else:
            raise ValueError(f"Unknown external provider: {request.provider}")

        latency_ms = round((time.perf_counter() - started_at) * 1000, 1)
        prompt_tokens = usage.get("prompt_tokens")
        tokens_generated = usage.get("completion_tokens") or _estimate_tokens(reply)

        return {
            "provider": request.provider,
            "model_id": request.model_id,
            "provider_model_name": model.get("provider_model_name"),
            "prompt": preview["prompt"],
            "messages": preview["messages"],
            "reply": reply,
            "full_text": f"{preview['prompt']}\n{reply}",
            "prompt_tokens": prompt_tokens,
            "estimated_prompt_tokens": preview["estimated_prompt_tokens"],
            "tokens_generated": tokens_generated,
            "prompt_style": preview["prompt_style"],
            "inference_mode": request.inference_mode,
            "temperature": preview["temperature"],
            "top_k": preview["top_k"],
            "latency_ms": latency_ms,
            "usage": usage,
        }

def _openai_compatible_model() -> dict:
    api_key = os.environ.get("CHATOKEN_EXTERNAL_OPENAI_API_KEY", "").strip()
    model_name = os.environ.get("CHATOKEN_EXTERNAL_OPENAI_MODEL", "").strip()
    base_url = os.environ.get(
        "CHATOKEN_EXTERNAL_OPENAI_BASE_URL",
        "https://api.openai.com/v1",
    ).strip()
    if api_key and model_name:
        state = "configured"
    elif not api_key and not model_name:
        state = "missing-config"
    elif not api_key:
        state = "missing-api-key"
    else:
        state = "missing-model"

    return {
        "model_id": "openai-compatible",
        "provider": "openai-compatible",
        "provider_model_name": model_name,
        "label": "OpenAI-compatible chat",
        "description": "Calls a chat/completions compatible HTTP endpoint from the API server.",
        "state": state,
        "requires_api_key": True,
        "base_url": base_url,
    }


def _ollama_model() -> dict:
    enabled = os.environ.get("CHATOKEN_EXTERNAL_OLLAMA_ENABLED", "").lower() in {
        "1",
        "true",
        "yes",
    }
    model_name = os.environ.get("CHATOKEN_EXTERNAL_OLLAMA_MODEL", "llama3.2").strip()
    base_url = os.environ.get(
        "CHATOKEN_EXTERNAL_OLLAMA_BASE_URL",
        "http://127.0.0.1:11434",
    ).strip()

    return {
        "model_id": "ollama-local",
        "provider": "ollama",
        "provider_model_name": model_name,
        "label": "Ollama local chat",
        "description": "Calls a local Ollama /api/chat endpoint from the API server.",
        "state": "configured" if enabled and model_name else "disabled",
        "requires_api_key": False,
        "base_url": base_url,
    }


def _model_for_request(request: ExternalChatRequestData, models: list[dict]) -> dict:
    for model in models:
        if model["provider"] == request.provider and model["model_id"] == request.model_id:
            return model
    raise ValueError(
        f"Unknown external model: provider={request.provider}, model_id={request.model_id}"
    )


def _ensure_model_ready(model: dict) -> None:
    if model["state"] in {"available", "configured"}:
        return
    if model["provider"] == "openai-compatible":
        raise ValueError(
            "OpenAI-compatible model is not configured. Set "
            "CHATOKEN_EXTERNAL_OPENAI_API_KEY and CHATOKEN_EXTERNAL_OPENAI_MODEL "
            "before starting the API server."
        )
    if model["provider"] == "ollama":
        raise ValueError(
            "Ollama model is disabled. Set CHATOKEN_EXTERNAL_OLLAMA_ENABLED=true "
            "and CHATOKEN_EXTERNAL_OLLAMA_MODEL before starting the API server."
        )
    raise ValueError(f"External model is not available: {model['model_id']}")


def _messages_for_request(request: ExternalChatRequestData) -> tuple[str, list[dict]]:
    prompt_style = _effective_prompt_style(request.prompt_style)

    if prompt_style in {"chat", "raw"}:
        rendered_prompt = request.message
    else:
        template = request.prompt_template if prompt_style == "custom" else None
        rendered_prompt = prepare_chat_prompt(request.message, prompt_style, template)

    messages = []
    if request.system_prompt.strip():
        messages.append({"role": "system", "content": request.system_prompt.strip()})
    messages.append({"role": "user", "content": rendered_prompt})

    if prompt_style == "chat" and request.system_prompt.strip():
        preview_prompt = (
            f"System: {request.system_prompt.strip()}\n"
            f"User: {request.message}\nAssistant:"
        )
    elif prompt_style == "chat":
        preview_prompt = f"User: {request.message}\nAssistant:"
    elif prompt_style == "raw" and request.system_prompt.strip():
        preview_prompt = f"System: {request.system_prompt.strip()}\n{request.message}"
    else:
        preview_prompt = rendered_prompt

    return preview_prompt, messages


def _call_openai_compatible(
    model: dict,
    request: ExternalChatRequestData,
    messages: list[dict],
) -> tuple[str, dict]:
    api_key = os.environ.get("CHATOKEN_EXTERNAL_OPENAI_API_KEY", "").strip()
    payload = {
        "model": model["provider_model_name"],
        "messages": messages,
        "max_tokens": request.max_new_tokens,
        "temperature": _generation_config(request)["temperature"],
    }
    response = _post_json(
        f"{model['base_url'].rstrip('/')}/chat/completions",
        payload,
        headers={"Authorization": f"Bearer {api_key}"},
    )
    choices = response.get("choices") or []
    if not choices:
        raise ValueError("OpenAI-compatible response did not include choices.")
    content = choices[0].get("message", {}).get("content", "")
    usage = response.get("usage") or {}
    return content, {
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
        "total_tokens": usage.get("total_tokens"),
    }


def _call_ollama(
    model: dict,
    request: ExternalChatRequestData,
    messages: list[dict],
) -> tuple[str, dict]:
    generation_config = _generation_config(request)
    options: dict[str, Any] = {
        "temperature": generation_config["temperature"],
        "num_predict": request.max_new_tokens,
    }
    if generation_config["top_k"] is not None:
        options["top_k"] = generation_config["top_k"]

    response = _post_json(
        f"{model['base_url'].rstrip('/')}/api/chat",
        {
            "model": model["provider_model_name"],
            "messages": messages,
            "stream": False,
            "options": options,
        },
    )
    content = response.get("message", {}).get("content", "")
    return content, {
        "prompt_tokens": response.get("prompt_eval_count"),
        "completion_tokens": response.get("eval_count"),
        "total_tokens": None,
    }


def _post_json(
    url: str,
    payload: dict,
    headers: dict | None = None,
) -> dict:
    timeout = float(os.environ.get("CHATOKEN_EXTERNAL_TIMEOUT_SECONDS", "60"))
    encoded = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=encoded,
        method="POST",
        headers={
            "Content-Type": "application/json",
            **(headers or {}),
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise ValueError(
            f"External provider request failed with HTTP {exc.code}: {body[:500]}"
        ) from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"External provider request failed: {exc.reason}") from exc


def _effective_prompt_style(prompt_style: str) -> str:
    if prompt_style in {"", "model-default"}:
        return "chat"
    if prompt_style in {"raw", "chat", "instruction", "custom"}:
        return prompt_style
    raise ValueError(f"Unknown prompt_style: {prompt_style}")


def _generation_config(request: ExternalChatRequestData) -> dict:
    if request.inference_mode not in INFERENCE_MODE_PRESETS:
        raise ValueError(f"Unknown inference_mode: {request.inference_mode}")

    preset = INFERENCE_MODE_PRESETS[request.inference_mode]
    if preset is None:
        return {
            "temperature": request.temperature,
            "top_k": request.top_k,
        }
    return dict(preset)


def _estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, (len(text) + 3) // 4)
