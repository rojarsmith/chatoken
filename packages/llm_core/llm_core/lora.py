from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import torch
import torch.nn as nn


@dataclass(frozen=True)
class LoRAConfig:
    rank: int = 8
    alpha: int = 16
    dropout: float = 0.05
    target_modules: tuple[str, ...] = ("W_query", "W_value")

    def to_dict(self) -> dict:
        data = asdict(self)
        data["target_modules"] = list(self.target_modules)
        return data


class LoRALinear(nn.Module):
    def __init__(self, base_layer: nn.Linear, *, rank: int, alpha: int, dropout: float) -> None:
        super().__init__()
        if rank < 1:
            raise ValueError("LoRA rank must be at least 1")

        self.base_layer = base_layer
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank
        self.dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

        for param in self.base_layer.parameters():
            param.requires_grad = False

        self.lora_a = nn.Parameter(
            torch.empty(
                rank,
                base_layer.in_features,
                device=base_layer.weight.device,
                dtype=base_layer.weight.dtype,
            )
        )
        self.lora_b = nn.Parameter(
            torch.zeros(
                base_layer.out_features,
                rank,
                device=base_layer.weight.device,
                dtype=base_layer.weight.dtype,
            )
        )
        nn.init.kaiming_uniform_(self.lora_a, a=math.sqrt(5))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        base_output = self.base_layer(x)
        lora_output = self.dropout(x) @ self.lora_a.transpose(0, 1)
        lora_output = lora_output @ self.lora_b.transpose(0, 1)
        return base_output + lora_output * self.scaling

    def merged_linear(self) -> nn.Linear:
        merged = nn.Linear(
            self.base_layer.in_features,
            self.base_layer.out_features,
            bias=self.base_layer.bias is not None,
            device=self.base_layer.weight.device,
            dtype=self.base_layer.weight.dtype,
        )
        with torch.no_grad():
            delta = (self.lora_b @ self.lora_a) * self.scaling
            merged.weight.copy_(self.base_layer.weight + delta)
            if self.base_layer.bias is not None:
                merged.bias.copy_(self.base_layer.bias)
        return merged


def apply_lora(model: nn.Module, config: LoRAConfig) -> dict:
    for param in model.parameters():
        param.requires_grad = False

    replaced = _replace_lora_targets(model, config)
    trainable = count_trainable_parameters(model)
    total = count_total_parameters(model)
    return {
        "rank": config.rank,
        "alpha": config.alpha,
        "dropout": config.dropout,
        "target_modules": list(config.target_modules),
        "replaced_modules": replaced,
        "trainable_parameters": trainable,
        "total_parameters": total,
        "trainable_percent": round((trainable / total) * 100, 4) if total else 0,
    }


def merge_lora_weights(model: nn.Module) -> int:
    return _merge_lora_targets(model)


def count_trainable_parameters(model: nn.Module) -> int:
    return sum(param.numel() for param in model.parameters() if param.requires_grad)


def count_total_parameters(model: nn.Module) -> int:
    return sum(param.numel() for param in model.parameters())


def _replace_lora_targets(module: nn.Module, config: LoRAConfig) -> int:
    replaced = 0
    for name, child in list(module.named_children()):
        if isinstance(child, nn.Linear) and name in config.target_modules:
            setattr(
                module,
                name,
                LoRALinear(
                    child,
                    rank=config.rank,
                    alpha=config.alpha,
                    dropout=config.dropout,
                ),
            )
            replaced += 1
        else:
            replaced += _replace_lora_targets(child, config)
    return replaced


def _merge_lora_targets(module: nn.Module) -> int:
    merged = 0
    for name, child in list(module.named_children()):
        if isinstance(child, LoRALinear):
            setattr(module, name, child.merged_linear())
            merged += 1
        else:
            merged += _merge_lora_targets(child)
    return merged
