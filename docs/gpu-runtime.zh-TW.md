# PyTorch GPU Runtime 設定

[English](gpu-runtime.md) | [繁體中文](gpu-runtime.zh-TW.md)

LLM ABC 不需要在程式碼裡切換 GPU。只要 `.venv` 裡的 PyTorch 看得到 CUDA device，後端就會自動使用 CUDA。

這主要是給 GPT-2 instruction SFT 使用。tiny from-scratch 學習階段仍然可以用 CPU。

## 前置條件

- 使用 Windows Command Prompt，不使用 PowerShell，也不使用 MSYS2。
- 使用專案本機的 `.venv`。
- 有 NVIDIA GPU，且 NVIDIA driver 可正常運作。
- 使用本專案 setup 支援的 Python。建議 Python 3.11、3.12 或 3.13。

先檢查 Windows 是否看得到 NVIDIA driver：

```cmd
nvidia-smi
```

如果這個指令不存在，或看不到 GPU，請先更新或安裝 NVIDIA driver，再更換 PyTorch。

## 檢查目前 PyTorch Runtime

在專案根目錄執行：

```cmd
cd /d C:\my\build\git-public\llm-abc
.venv\Scripts\activate.bat

python -c "import sys, torch; print(sys.executable); print(torch.__version__); print('cuda_available', torch.cuda.is_available()); print('cuda_version', torch.version.cuda); print('device_count', torch.cuda.device_count()); print('device_name', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
```

如果版本尾端是 `+cpu`，或看到 `cuda_available False`，表示目前是 CPU-only 環境。

## 安裝 CUDA 版 PyTorch

更換 PyTorch 前，先停止 API。

請以官方 PyTorch install selector 產生目前最新指令：

```text
https://pytorch.org/get-started/locally/
```

選項：

- PyTorch Build: Stable
- Your OS: Windows
- Package: Pip
- Language: Python
- Compute Platform: CUDA，通常選 selector 顯示的最新 CUDA 選項

CUDA 12.8 範例：

```cmd
python -m pip uninstall -y torch torchvision torchaudio
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
python -m pip install -e . -r apps\api\requirements.txt
```

如果 CUDA 12.8 和你的 driver 不相容，請回到 selector 選其他 CUDA 版本。常見替代選項：

```cmd
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

本專案實際只 import `torch`，但官方 PyTorch 指令會一起安裝 `torchvision` 和 `torchaudio`。照官方指令做，較能避免套件 build 版本不一致。

## 驗證 CUDA

再次執行本機 Python 檢查：

```cmd
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.version.cuda); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
```

預期 `torch.cuda.is_available()` 會印出：

```text
True
```

然後重啟 API：

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

在另一個 Windows Command Prompt 執行：

```cmd
curl -s http://127.0.0.1:8000/health
```

預期 API 回應包含：

```json
{"device":"cuda","cuda_available":true}
```

Web UI 頂部也應該顯示 GPU 名稱，而不是 `CPU only`。

## 如果還是顯示 CPU

請依序檢查：

1. `where python` 和 `python -c "import sys; print(sys.executable)"` 必須指向 `C:\my\build\git-public\llm-abc\.venv` 裡面。
2. 安裝 CUDA 版 PyTorch 後，必須重啟 API。
3. 執行 `nvidia-smi`；如果失敗，先修 NVIDIA driver。
4. 回到官方 PyTorch selector，重新產生並執行安裝指令。
5. 這個 setup 不要用 MSYS2 執行，請使用 Windows Command Prompt。
