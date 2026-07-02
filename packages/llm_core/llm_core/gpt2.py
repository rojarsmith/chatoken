from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import requests
import torch

from llm_core.configs import ModelConfig
from llm_core.model import GPTModel


ProgressCallback = Callable[[dict], None]


@dataclass(frozen=True)
class GPT2ModelSpec:
    model_size: str
    model_id: str
    label: str
    hf_repo: str
    parameters: int
    recommended: bool = False


GPT2_MODEL_SPECS: dict[str, GPT2ModelSpec] = {
    "124M": GPT2ModelSpec(
        model_size="124M",
        model_id="gpt2-124M",
        label="GPT-2 small",
        hf_repo="openai-community/gpt2",
        parameters=124_000_000,
        recommended=True,
    ),
    "355M": GPT2ModelSpec(
        model_size="355M",
        model_id="gpt2-355M",
        label="GPT-2 medium",
        hf_repo="openai-community/gpt2-medium",
        parameters=355_000_000,
    ),
    "774M": GPT2ModelSpec(
        model_size="774M",
        model_id="gpt2-774M",
        label="GPT-2 large",
        hf_repo="openai-community/gpt2-large",
        parameters=774_000_000,
    ),
    "1558M": GPT2ModelSpec(
        model_size="1558M",
        model_id="gpt2-1558M",
        label="GPT-2 XL",
        hf_repo="openai-community/gpt2-xl",
        parameters=1_558_000_000,
    ),
}


def list_gpt2_models(models_dir: Path) -> list[dict]:
    return [
        {
            "model_size": spec.model_size,
            "model_id": spec.model_id,
            "label": spec.label,
            "hf_repo": spec.hf_repo,
            "parameters": spec.parameters,
            "recommended": spec.recommended,
            "downloaded": _has_complete_download(models_dir, spec),
            "model_path": str(_model_file(models_dir, spec)),
            "config_path": str(_config_file(models_dir, spec)),
        }
        for spec in GPT2_MODEL_SPECS.values()
    ]


def download_and_load_gpt2(
    *,
    model_size: str,
    models_dir: Path,
    model_id: str | None = None,
    progress_callback: ProgressCallback | None = None,
) -> tuple[ModelConfig, GPTModel]:
    spec = _spec_for_size(model_size)
    target_model_id = model_id or spec.model_id
    _download_gpt2_files(models_dir=models_dir, spec=spec, progress_callback=progress_callback)
    hf_config = json.loads(_config_file(models_dir, spec).read_text(encoding="utf-8"))
    model_config = ModelConfig(
        name=target_model_id,
        description=f"Downloaded {spec.label} pretrained model.",
        vocab_size=int(hf_config["vocab_size"]),
        context_length=int(hf_config.get("n_positions") or hf_config.get("n_ctx")),
        emb_dim=int(hf_config["n_embd"]),
        n_heads=int(hf_config["n_head"]),
        n_layers=int(hf_config["n_layer"]),
        drop_rate=0.1,
        qkv_bias=True,
        tokenizer="gpt2",
        seed=123,
        prompt_style="instruction",
    )
    model = GPTModel(model_config.to_dict())
    state_dict = torch.load(_model_file(models_dir, spec), map_location="cpu")
    _load_hf_gpt2_weights(model, state_dict)
    model.eval()
    if progress_callback is not None:
        progress_callback({"stage": "loaded", "message": f"Loaded {target_model_id}"})
    return model_config, model


def _download_gpt2_files(
    *,
    models_dir: Path,
    spec: GPT2ModelSpec,
    progress_callback: ProgressCallback | None,
) -> None:
    model_dir = _model_dir(models_dir, spec)
    model_dir.mkdir(parents=True, exist_ok=True)
    had_complete_marker = _complete_file(models_dir, spec).exists()
    if _has_complete_download(models_dir, spec):
        if progress_callback is not None:
            progress_callback({"stage": "cached", "message": f"{spec.model_id} cached"})
        return

    _download_if_needed(
        url=f"https://huggingface.co/{spec.hf_repo}/resolve/main/config.json",
        destination=_config_file(models_dir, spec),
        progress_callback=progress_callback,
        stage="config",
        trust_existing=had_complete_marker,
    )
    _download_if_needed(
        url=f"https://huggingface.co/{spec.hf_repo}/resolve/main/pytorch_model.bin",
        destination=_model_file(models_dir, spec),
        progress_callback=progress_callback,
        stage="weights",
        trust_existing=had_complete_marker,
    )
    _download_if_needed(
        url=f"https://huggingface.co/{spec.hf_repo}/resolve/main/vocab.json",
        destination=_vocab_file(models_dir, spec),
        progress_callback=progress_callback,
        stage="tokenizer",
        trust_existing=True,
    )
    _download_if_needed(
        url=f"https://huggingface.co/{spec.hf_repo}/resolve/main/merges.txt",
        destination=_merges_file(models_dir, spec),
        progress_callback=progress_callback,
        stage="tokenizer",
        trust_existing=True,
    )
    _complete_file(models_dir, spec).write_text("ok\n", encoding="utf-8")


def _download_if_needed(
    *,
    url: str,
    destination: Path,
    progress_callback: ProgressCallback | None,
    stage: str,
    trust_existing: bool,
) -> None:
    if trust_existing and destination.exists() and destination.stat().st_size > 0:
        if progress_callback is not None:
            progress_callback({"stage": stage, "message": f"{destination.name} cached"})
        return
    _download_file(
        url=url,
        destination=destination,
        progress_callback=progress_callback,
        stage=stage,
    )


def _download_file(
    *,
    url: str,
    destination: Path,
    progress_callback: ProgressCallback | None,
    stage: str,
) -> None:
    headers: dict[str, str] = {}
    existing_size = destination.stat().st_size if destination.exists() else 0
    if existing_size > 0:
        headers["Range"] = f"bytes={existing_size}-"

    with requests.get(url, stream=True, timeout=60, headers=headers) as response:
        if response.status_code == 416 and destination.exists():
            if progress_callback is not None:
                progress_callback({"stage": stage, "message": f"{destination.name} cached"})
            return
        if response.status_code != 206:
            existing_size = 0
        response.raise_for_status()
        total_size = _total_size(response, existing_size)

        mode = "ab" if existing_size else "wb"
        downloaded = existing_size
        last_reported = existing_size
        with destination.open(mode) as file:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                file.write(chunk)
                downloaded += len(chunk)
                should_report = (
                    total_size is not None
                    and downloaded >= total_size
                    or downloaded - last_reported >= 16 * 1024 * 1024
                )
                if progress_callback is not None and should_report:
                    last_reported = downloaded
                    progress_callback(
                        {
                            "stage": stage,
                            "file": destination.name,
                            "downloaded_bytes": downloaded,
                            "total_bytes": total_size,
                        }
                    )


def _load_hf_gpt2_weights(model: GPTModel, state_dict: dict[str, torch.Tensor]) -> None:
    def key(name: str) -> str:
        if name in state_dict:
            return name
        prefixed = f"transformer.{name}"
        if prefixed in state_dict:
            return prefixed
        raise KeyError(name)

    with torch.no_grad():
        model.tok_emb.weight.copy_(state_dict[key("wte.weight")])
        model.pos_emb.weight.copy_(state_dict[key("wpe.weight")])

        for block_index, block in enumerate(model.trf_blocks):
            prefix = f"h.{block_index}"
            q_w, k_w, v_w = torch.split(
                state_dict[key(f"{prefix}.attn.c_attn.weight")],
                model.tok_emb.embedding_dim,
                dim=1,
            )
            q_b, k_b, v_b = torch.split(
                state_dict[key(f"{prefix}.attn.c_attn.bias")],
                model.tok_emb.embedding_dim,
                dim=0,
            )
            block.att.W_query.weight.copy_(q_w.T)
            block.att.W_key.weight.copy_(k_w.T)
            block.att.W_value.weight.copy_(v_w.T)
            block.att.W_query.bias.copy_(q_b)
            block.att.W_key.bias.copy_(k_b)
            block.att.W_value.bias.copy_(v_b)

            block.att.out_proj.weight.copy_(state_dict[key(f"{prefix}.attn.c_proj.weight")].T)
            block.att.out_proj.bias.copy_(state_dict[key(f"{prefix}.attn.c_proj.bias")])
            block.ff.layers[0].weight.copy_(state_dict[key(f"{prefix}.mlp.c_fc.weight")].T)
            block.ff.layers[0].bias.copy_(state_dict[key(f"{prefix}.mlp.c_fc.bias")])
            block.ff.layers[2].weight.copy_(state_dict[key(f"{prefix}.mlp.c_proj.weight")].T)
            block.ff.layers[2].bias.copy_(state_dict[key(f"{prefix}.mlp.c_proj.bias")])
            block.norm1.scale.copy_(state_dict[key(f"{prefix}.ln_1.weight")])
            block.norm1.shift.copy_(state_dict[key(f"{prefix}.ln_1.bias")])
            block.norm2.scale.copy_(state_dict[key(f"{prefix}.ln_2.weight")])
            block.norm2.shift.copy_(state_dict[key(f"{prefix}.ln_2.bias")])

        model.final_norm.scale.copy_(state_dict[key("ln_f.weight")])
        model.final_norm.shift.copy_(state_dict[key("ln_f.bias")])
        model.out_head.weight.copy_(
            state_dict.get("lm_head.weight", state_dict[key("wte.weight")])
        )


def _spec_for_size(model_size: str) -> GPT2ModelSpec:
    try:
        return GPT2_MODEL_SPECS[model_size]
    except KeyError as exc:
        raise ValueError(f"Unsupported GPT-2 model_size: {model_size}") from exc


def _model_dir(models_dir: Path, spec: GPT2ModelSpec) -> Path:
    return models_dir / spec.model_size


def _config_file(models_dir: Path, spec: GPT2ModelSpec) -> Path:
    return _model_dir(models_dir, spec) / "config.json"


def _model_file(models_dir: Path, spec: GPT2ModelSpec) -> Path:
    return _model_dir(models_dir, spec) / "pytorch_model.bin"


def _vocab_file(models_dir: Path, spec: GPT2ModelSpec) -> Path:
    return _model_dir(models_dir, spec) / "vocab.json"


def _merges_file(models_dir: Path, spec: GPT2ModelSpec) -> Path:
    return _model_dir(models_dir, spec) / "merges.txt"


def _complete_file(models_dir: Path, spec: GPT2ModelSpec) -> Path:
    return _model_dir(models_dir, spec) / ".complete"


def _has_complete_download(models_dir: Path, spec: GPT2ModelSpec) -> bool:
    return all(
        path.exists() and path.stat().st_size > 0
        for path in (
            _complete_file(models_dir, spec),
            _config_file(models_dir, spec),
            _model_file(models_dir, spec),
            _vocab_file(models_dir, spec),
            _merges_file(models_dir, spec),
        )
    )


def _total_size(response: requests.Response, existing_size: int) -> int | None:
    content_range = response.headers.get("Content-Range")
    if content_range and "/" in content_range:
        try:
            return int(content_range.rsplit("/", 1)[1])
        except ValueError:
            return None
    content_length = response.headers.get("Content-Length")
    if content_length is None:
        return None
    try:
        return existing_size + int(content_length)
    except ValueError:
        return None
