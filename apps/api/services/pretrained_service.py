from __future__ import annotations

from pathlib import Path
from typing import Callable

import torch

from apps.api.services.chat_service import ChatService
from llm_core.gpt2 import download_and_load_gpt2, list_gpt2_models


class PretrainedService:
    def __init__(self, chat_service: ChatService, project_root: Path | None = None) -> None:
        self._chat_service = chat_service
        self._project_root = project_root or Path(__file__).resolve().parents[3]
        self._gpt2_dir = self._project_root / "models" / "downloaded" / "gpt2"

    def list_models(self) -> list[dict]:
        return list_gpt2_models(self._gpt2_dir)

    def download_and_load(
        self,
        *,
        model_size: str,
        model_id: str | None = None,
        progress_callback: Callable[[dict], None] | None = None,
    ) -> dict:
        model_config, model = download_and_load_gpt2(
            model_size=model_size,
            models_dir=self._gpt2_dir,
            model_id=model_id,
            progress_callback=progress_callback,
        )
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        loaded = self._chat_service.register_model(
            model_id=model_config.name,
            config=model_config,
            model=model,
            device=device,
            state="loaded-pretrained",
        )
        return {
            **loaded,
            "model_size": model_size,
            "tokenizer": model_config.tokenizer,
            "context_length": model_config.context_length,
            "prompt_style": model_config.prompt_style,
        }
