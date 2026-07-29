"""Which device the models run on, and letting the learner choose it.

Before this module the device was decided independently in five places, each
hard-coding `cuda if torch.cuda.is_available() else cpu`. That is the right
default, but it left no way to answer a question the course keeps raising: how
much of this is the GPU doing? Stage 04 on CPU versus CUDA is a far more
concrete lesson than a paragraph claiming CUDA is faster.

The preference is process-wide and in memory, like every other runtime choice
here: it resets when the API restarts.
"""

from __future__ import annotations

from threading import Lock
from typing import Literal

import torch


DevicePreference = Literal["auto", "cuda", "cpu"]

_preference: DevicePreference = "auto"
_lock = Lock()


def get_preference() -> DevicePreference:
    with _lock:
        return _preference


def set_preference(preference: DevicePreference) -> DevicePreference:
    """Record the preference. Asking for CUDA without CUDA is an error, not a
    silent fallback — a learner who selects it deserves to know it did not take."""
    if preference not in ("auto", "cuda", "cpu"):
        raise ValueError(f"Unknown device preference: {preference}")
    if preference == "cuda" and not torch.cuda.is_available():
        raise ValueError(
            "CUDA is not available in this environment. Install a CUDA build of "
            "PyTorch and restart the API — see docs/reference/gpu-runtime.md."
        )

    global _preference
    with _lock:
        _preference = preference
    return preference


def resolve() -> torch.device:
    """The device work should actually run on right now."""
    preference = get_preference()
    if preference == "cpu":
        return torch.device("cpu")
    if preference == "cuda":
        return torch.device("cuda")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def describe() -> dict:
    """Everything the console needs to render the device control honestly."""
    cuda_available = torch.cuda.is_available()
    effective = resolve()
    return {
        "preference": get_preference(),
        "device": str(effective),
        "cuda_available": cuda_available,
        "cuda_version": torch.version.cuda,
        "device_count": torch.cuda.device_count(),
        "device_name": torch.cuda.get_device_name(0) if cuda_available else None,
        "torch_version": torch.__version__,
        "options": [
            {
                "id": "auto",
                "label": "Auto",
                "available": True,
                "note": "CUDA when present, otherwise CPU",
            },
            {
                "id": "cuda",
                "label": "GPU (CUDA)",
                "available": cuda_available,
                "note": torch.cuda.get_device_name(0) if cuda_available else "No CUDA device",
            },
            {
                "id": "cpu",
                "label": "CPU",
                "available": True,
                "note": "Force CPU — useful for comparing training speed",
            },
        ],
    }
