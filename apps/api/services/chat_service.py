from __future__ import annotations

from concurrent.futures import CancelledError
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Callable, Iterator

import torch

from llm_core.checkpoints import (
    checkpoint_metadata,
    find_checkpoint,
    list_checkpoints,
    load_checkpoint,
)
from llm_core.configs import MODEL_CONFIGS, ModelConfig
from llm_core.generation import prepare_chat_prompt
from llm_core.model import GPTModel, count_parameters
from llm_core.tokenizer import Tokenizer, tokenizer_for_name


@dataclass(frozen=True)
class ChatRequestData:
    message: str
    model_id: str
    max_new_tokens: int
    temperature: float
    top_k: int | None
    include_prompt: bool


@dataclass
class LoadedModel:
    model_id: str
    config: ModelConfig
    tokenizer: Tokenizer
    model: GPTModel
    device: torch.device
    state: str = "loaded-model"


class ChatService:
    def __init__(self, checkpoint_dir: Path | None = None) -> None:
        self._models: dict[str, LoadedModel] = {}
        self._locks: dict[str, Lock] = {}
        self._checkpoint_dir = checkpoint_dir or _project_root() / "models" / "checkpoints"

    def list_models(self) -> list[dict]:
        static_models = [
            {
                "model_id": model_id,
                "description": cfg.description,
                "tokenizer": cfg.tokenizer,
                "context_length": cfg.context_length,
                "parameters": count_parameters(GPTModel(cfg.to_dict())),
                "prompt_style": cfg.prompt_style,
                "state": "loaded-random" if model_id in self._models else "random-untrained",
            }
            for model_id, cfg in MODEL_CONFIGS.items()
        ]
        loaded_checkpoint_models = [
            {
                "model_id": model_id,
                "description": loaded.config.description,
                "tokenizer": loaded.config.tokenizer,
                "context_length": loaded.config.context_length,
                "parameters": count_parameters(loaded.model),
                "prompt_style": loaded.config.prompt_style,
                "state": loaded.state,
            }
            for model_id, loaded in self._models.items()
            if model_id not in MODEL_CONFIGS
        ]
        return static_models + loaded_checkpoint_models

    def list_checkpoints(self) -> list[dict]:
        return list_checkpoints(self._checkpoint_dir)

    def load_checkpoint_model(self, checkpoint_id: str, model_id: str | None = None) -> dict:
        checkpoint_path = find_checkpoint(self._checkpoint_dir, checkpoint_id)
        payload = load_checkpoint(checkpoint_path, map_location="cpu")
        metadata = checkpoint_metadata(checkpoint_path, payload)
        loaded_model_id = model_id or payload["model_id"]
        config_data = dict(payload["model_config"])
        config_data["name"] = loaded_model_id
        config_data["description"] = f"Checkpoint model loaded from {checkpoint_id}."
        model_config = ModelConfig(**config_data)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = GPTModel(model_config.to_dict()).to(device)
        model.load_state_dict(payload["state_dict"])
        model.eval()

        self.register_model(
            model_id=loaded_model_id,
            config=model_config,
            model=model,
            device=device,
            state="loaded-checkpoint",
        )
        return {
            "model_id": loaded_model_id,
            "checkpoint_id": checkpoint_id,
            "device": str(device),
            "state": "loaded-checkpoint",
            "version": metadata.get("version"),
            "version_id": metadata.get("version_id"),
            "version_label": metadata.get("version_label"),
        }

    def register_model(
        self,
        *,
        model_id: str,
        config: ModelConfig,
        model: GPTModel,
        device: torch.device | None = None,
        state: str = "loaded-model",
    ) -> dict:
        target_device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(target_device)
        model.eval()
        self._models[model_id] = LoadedModel(
            model_id=model_id,
            config=config,
            tokenizer=tokenizer_for_name(config.tokenizer),
            model=model,
            device=target_device,
            state=state,
        )
        self._locks.setdefault(model_id, Lock())
        return {
            "model_id": model_id,
            "device": str(target_device),
            "state": state,
        }

    def clone_model_for_training(self, model_id: str) -> LoadedModel:
        loaded = self._get_model(model_id)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = GPTModel(loaded.config.to_dict()).to(device)
        with self._locks[model_id]:
            state_dict = {
                key: value.detach().cpu().clone()
                for key, value in loaded.model.state_dict().items()
            }
        model.load_state_dict(state_dict)
        model.eval()
        return LoadedModel(
            model_id=model_id,
            config=loaded.config,
            tokenizer=tokenizer_for_name(loaded.config.tokenizer),
            model=model,
            device=device,
            state=loaded.state,
        )

    def generate_reply(self, request: ChatRequestData) -> dict:
        result = None
        for event in self.stream_reply(request):
            if event["event"] == "done":
                result = event["result"]
        if result is None:
            raise RuntimeError("Chat generation produced no result.")
        return result

    def stream_reply(
        self,
        request: ChatRequestData,
        should_cancel: Callable[[], bool] | None = None,
    ) -> Iterator[dict]:
        loaded = self._get_model(request.model_id)
        prompt = prepare_chat_prompt(request.message, loaded.config.prompt_style)
        input_ids = loaded.tokenizer.encode(prompt)
        if not input_ids:
            input_ids = [loaded.tokenizer.eos_id]

        idx = torch.tensor(input_ids, dtype=torch.long, device=loaded.device).unsqueeze(0)
        generated_ids: list[int] = []
        full_reply = ""

        yield {
            "event": "start",
            "model_id": request.model_id,
            "prompt": prompt,
            "prompt_tokens": len(input_ids),
            "tokens_generated": 0,
        }

        with self._locks[request.model_id]:
            loaded.model.eval()
            for token_index in range(request.max_new_tokens):
                if should_cancel is not None and should_cancel():
                    raise CancelledError("Chat generation cancelled.")

                idx_cond = idx[:, -loaded.config.context_length :]
                with torch.no_grad():
                    logits = loaded.model(idx_cond)

                logits = logits[:, -1, :]
                if request.top_k is not None:
                    top_logits, _ = torch.topk(
                        logits,
                        min(request.top_k, logits.shape[-1]),
                    )
                    min_val = top_logits[:, -1]
                    logits = torch.where(
                        logits < min_val,
                        torch.tensor(float("-inf"), device=logits.device),
                        logits,
                    )

                if request.temperature > 0.0:
                    logits = logits / request.temperature
                    probs = torch.softmax(logits, dim=-1)
                    idx_next = torch.multinomial(probs, num_samples=1)
                else:
                    idx_next = torch.argmax(logits, dim=-1, keepdim=True)

                token_id = int(idx_next.item())
                if loaded.tokenizer.eos_id is not None and token_id == loaded.tokenizer.eos_id:
                    break

                idx = torch.cat((idx, idx_next), dim=1)
                generated_ids.append(token_id)
                next_reply = _clean_reply(
                    loaded.tokenizer.decode(generated_ids),
                    prompt_style=loaded.config.prompt_style,
                )
                delta = next_reply[len(full_reply) :]
                full_reply = next_reply
                full_text = loaded.tokenizer.decode(input_ids + generated_ids)

                yield {
                    "event": "token",
                    "model_id": request.model_id,
                    "token_index": token_index,
                    "token_id": token_id,
                    "delta": delta,
                    "reply": full_reply,
                    "full_text": full_text,
                    "tokens_generated": len(generated_ids),
                }

        full_text = loaded.tokenizer.decode(input_ids + generated_ids)
        result = {
            "model_id": request.model_id,
            "prompt": prompt,
            "reply": full_text if request.include_prompt else full_reply,
            "full_text": full_text,
            "prompt_tokens": len(input_ids),
            "tokens_generated": len(generated_ids),
        }

        yield {"event": "done", "result": result}

    def _get_model(self, model_id: str) -> LoadedModel:
        if model_id not in MODEL_CONFIGS:
            if model_id in self._models:
                return self._models[model_id]
            raise ValueError(f"Unknown model_id: {model_id}")

        if model_id not in self._models:
            self._models[model_id] = self._load_random_model(model_id, MODEL_CONFIGS[model_id])
            self._locks[model_id] = Lock()

        return self._models[model_id]

    def _load_random_model(self, model_id: str, config: ModelConfig) -> LoadedModel:
        torch.manual_seed(config.seed)
        tokenizer = tokenizer_for_name(config.tokenizer)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = GPTModel(config.to_dict()).to(device)
        model.eval()
        return LoadedModel(
            model_id=model_id,
            config=config,
            tokenizer=tokenizer,
            model=model,
            device=device,
            state="loaded-random",
        )


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _clean_reply(text: str, *, prompt_style: str) -> str:
    reply = text.strip()
    if prompt_style == "instruction":
        reply = reply.replace("### Response:", "", 1).strip()
    return reply
