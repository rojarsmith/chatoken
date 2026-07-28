# Reference · GPU runtime

[English](gpu-runtime.md) | [繁體中文](gpu-runtime.zh-TW.md)

[課程索引](../README.zh-TW.md)

Chatoken 不需要改任何程式碼就能使用 GPU。只要 `.venv` 內的 PyTorch build 看得到 CUDA 裝置，
後端就會自動選用 CUDA。

**什麼時候需要：** Part 1 與 Part 2 在 CPU 上完全沒問題——tiny 模型真的很小。從
[Stage 10](../stages/10-instruction-sft.zh-TW.md) 開始，每一步都要跑完整的 GPT-2 forward 與
backward，CPU 就只剩 smoke test 的價值，不再是可行的工作流程。

## 前置需求

- Windows Command Prompt，不是 PowerShell、也不是 MSYS2。
- 專案本地的 `.venv`（見 [安裝設定](setup.zh-TW.md)）。
- 一張 NVIDIA GPU 與可用的驅動程式。
- Python 3.11、3.12 或 3.13。

確認 Windows 看得到驅動程式：

```cmd
nvidia-smi
```

如果失敗，先修好 NVIDIA 驅動程式，再動 PyTorch。

## 檢查目前的 runtime

從專案根目錄：

```cmd
.venv\Scripts\activate.bat

python -c "import sys, torch; print(sys.executable); print(torch.__version__); print('cuda_available', torch.cuda.is_available()); print('cuda_version', torch.version.cuda); print('device_count', torch.cuda.device_count()); print('device_name', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
```

版本結尾是 `+cpu`，或 `cuda_available False`，都代表目前環境是 CPU-only。

## 安裝 CUDA 版 PyTorch

先停掉 API。

到官方選擇器 `https://pytorch.org/get-started/locally/`，選擇：Stable · Windows · Pip ·
Python · CUDA。以 CUDA 12.8 為例：

```cmd
python -m pip uninstall -y torch torchvision torchaudio
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
python -m pip install -e . -r apps\api\requirements.txt
```

若 12.8 與你的驅動程式不相容，改用其他版本：

```cmd
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

本專案只 import `torch`，但官方指令包含 `torchvision` 與 `torchaudio`。
保持指令完整可以避免套件版本不搭。

## 驗證

```cmd
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.version.cuda); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
```

`torch.cuda.is_available()` 必須印出 `True`。然後重啟 API：

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

從另一個 Command Prompt：

```cmd
curl -s http://127.0.0.1:8000/health
```

預期得到 `{"device":"cuda","cuda_available":true}`。控制台頂端會顯示 GPU 名稱而不是 `CPU only`。

## 如果它還是顯示 CPU

依序檢查：

1. `where python` 與 `python -c "import sys; print(sys.executable)"` 兩者都必須指向專案的 `.venv` 內。
2. 重啟 API——執行中的行程會沿用舊的 torch build。
3. `nvidia-smi`——若失敗，問題在驅動程式，不在 PyTorch。
4. 重新執行官方選擇器給的安裝指令。
5. 使用 Windows Command Prompt，不要用 MSYS2。

## CUDA 修得了什麼、修不了什麼

| 修得了 | 修不了 |
| --- | --- |
| GPT-2 SFT、LoRA、Chat SFT 的訓練時間 | 在固定步數下的模型品質 |
| `block_size` 與 `batch_size` 的實務上限 | tiny 模型 64 token 的 context 視窗 |
| 把 Stage 12 的 240 步從數小時變成數分鐘 | 一個太小的資料集 |

更快的裝置讓你能跑更多實驗，但不會讓任何單一實驗變得更好。
