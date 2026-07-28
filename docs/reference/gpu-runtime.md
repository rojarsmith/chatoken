# Reference · GPU runtime

[English](gpu-runtime.md) | [繁體中文](gpu-runtime.zh-TW.md)

[Course index](../README.md)

Chatoken needs no code change to use a GPU. The backend selects CUDA automatically whenever
the PyTorch build inside `.venv` can see a CUDA device.

**When you need this:** Parts 1 and 2 are fine on CPU — the tiny model is tiny. From
[Stage 10](../stages/10-instruction-sft.md) onward every step runs a full GPT-2 forward and
backward pass, and CPU becomes a smoke test rather than a workflow.

## Prerequisites

- Windows Command Prompt, not PowerShell and not MSYS2.
- A project-local `.venv` (see [setup](setup.md)).
- An NVIDIA GPU with a working driver.
- Python 3.11, 3.12, or 3.13.

Confirm Windows sees the driver:

```cmd
nvidia-smi
```

If that fails, fix the NVIDIA driver before touching PyTorch.

## Check the current runtime

From the project root:

```cmd
.venv\Scripts\activate.bat

python -c "import sys, torch; print(sys.executable); print(torch.__version__); print('cuda_available', torch.cuda.is_available()); print('cuda_version', torch.version.cuda); print('device_count', torch.cuda.device_count()); print('device_name', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
```

A version ending in `+cpu`, or `cuda_available False`, means the environment is CPU-only.

## Install CUDA PyTorch

Stop the API first.

Use the official selector at `https://pytorch.org/get-started/locally/` with: Stable ·
Windows · Pip · Python · CUDA. Example for CUDA 12.8:

```cmd
python -m pip uninstall -y torch torchvision torchaudio
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
python -m pip install -e . -r apps\api\requirements.txt
```

If 12.8 does not match your driver, try another:

```cmd
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

This project imports only `torch`, but the official command includes `torchvision` and
`torchaudio`. Keeping the command intact avoids mismatched builds.

## Verify

```cmd
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.version.cuda); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
```

`torch.cuda.is_available()` must print `True`. Restart the API:

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

From another Command Prompt:

```cmd
curl -s http://127.0.0.1:8000/health
```

Expect `{"device":"cuda","cuda_available":true}`. The console's top bar shows the GPU name
instead of `CPU only`.

## If it still says CPU

Check in this order:

1. `where python` and `python -c "import sys; print(sys.executable)"` must both point inside
   the project's `.venv`.
2. Restart the API — a running process keeps the old torch build.
3. `nvidia-smi` — if that fails, the driver is the problem, not PyTorch.
4. Re-run the install command from the official selector.
5. Use Windows Command Prompt, not MSYS2.

## What CUDA does and does not fix

| Fixes | Does not fix |
| --- | --- |
| Training time for GPT-2 SFT, LoRA, and Chat SFT | Model quality at a given number of steps |
| Practical `block_size` and `batch_size` ceilings | The tiny model's 64-token context window |
| Turning Stage 12's 240 steps from hours into minutes | A dataset that is too small |

A faster device lets you run more experiments. It does not make any single experiment better.
