# GPU Runtime Setup for PyTorch

[English](gpu-runtime.md) | [繁體中文](gpu-runtime.zh-TW.md)

LLM ABC does not need a code switch to use GPU. The backend chooses CUDA automatically when the PyTorch build in `.venv` can see a CUDA device.

Use this for GPT-2 instruction SFT. The tiny from-scratch lessons are still fine on CPU.

## Prerequisites

- Windows Command Prompt, not PowerShell and not MSYS2.
- A project-local `.venv`.
- An NVIDIA GPU and a working NVIDIA driver.
- A Python version supported by this project setup. Use Python 3.11, 3.12, or 3.13.

Check whether Windows can see the NVIDIA driver:

```cmd
nvidia-smi
```

If this command is not found or cannot see a GPU, update or install the NVIDIA driver before changing PyTorch.

## Check the Current PyTorch Runtime

From the project root:

```cmd
cd /d C:\my\build\git-public\llm-abc
.venv\Scripts\activate.bat

python -c "import sys, torch; print(sys.executable); print(torch.__version__); print('cuda_available', torch.cuda.is_available()); print('cuda_version', torch.version.cuda); print('device_count', torch.cuda.device_count()); print('device_name', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
```

If the version ends with `+cpu` or `cuda_available False`, the current environment is CPU-only.

## Install CUDA PyTorch

Stop the API before replacing PyTorch.

Use the official PyTorch install selector for the current command:

```text
https://pytorch.org/get-started/locally/
```

Choose:

- PyTorch Build: Stable
- Your OS: Windows
- Package: Pip
- Language: Python
- Compute Platform: CUDA, usually the newest CUDA option shown by the selector

Example for CUDA 12.8:

```cmd
python -m pip uninstall -y torch torchvision torchaudio
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
python -m pip install -e . -r apps\api\requirements.txt
```

If CUDA 12.8 is not compatible with your driver, use the selector and choose another CUDA option. Common alternatives are:

```cmd
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

This project only imports `torch`, but the official PyTorch command includes `torchvision` and `torchaudio`. Keeping the official command helps avoid mismatched package builds.

## Verify CUDA

Run the local Python check again:

```cmd
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.version.cuda); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
```

Expected result:

```text
True
```

for `torch.cuda.is_available()`.

Then restart the API:

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

From another Windows Command Prompt:

```cmd
curl -s http://127.0.0.1:8000/health
```

Expected API result includes:

```json
{"device":"cuda","cuda_available":true}
```

The Web UI top bar should show the GPU name instead of `CPU only`.

## If It Still Shows CPU

Check these in order:

1. `where python` and `python -c "import sys; print(sys.executable)"` must point inside `C:\my\build\git-public\llm-abc\.venv`.
2. Restart the API after installing the CUDA PyTorch build.
3. Run `nvidia-smi`; if it fails, fix the NVIDIA driver first.
4. Re-run the PyTorch install command from the official selector.
5. Avoid running the project from MSYS2 for this setup; use Windows Command Prompt.
