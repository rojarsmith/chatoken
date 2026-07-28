# Reference · 安裝設定

[English](setup.md) | [繁體中文](setup.zh-TW.md)

[課程索引](../README.zh-TW.md)

課程假設這些都已經可以運作。做一次就好。

## 需求

- Windows，使用 **Command Prompt（`cmd.exe`）**——不是 PowerShell，也不是 MSYS2。
- **Windows CPython 3.11、3.12 或 3.13。** 不能是 3.14：在這個環境下沒有對應的 PyTorch wheel。
- Node.js 18 以上，供 web 控制台使用。
- Part 1 與 Part 2 不一定需要 NVIDIA GPU，但從 Stage 10 起強烈建議。

檢查 `cmd.exe` 會用哪個 Python：

```cmd
where python
python --version
python -c "import sys; raise SystemExit(0 if (3, 11) <= sys.version_info[:2] < (3, 14) else 'Use Python 3.11, 3.12, or 3.13 for this project')"
```

## 建立虛擬環境

本課程中每一個 Python 指令都在專案本地的 `.venv` 內執行。

```cmd
python -m venv .venv
.venv\Scripts\activate.bat

python -m pip install --upgrade pip
python -c "import sys; print(sys.executable); print(sys.version)"
python -m pip install -e . -r apps\api\requirements.txt
```

啟用之後，`python` 與 `pip` 必須解析到 `.venv` 內。用
`python -c "import sys; print(sys.executable)"` 驗證——路徑必須包含你的專案資料夾。

### 若 Python 版本錯了就重建

```cmd
if defined VIRTUAL_ENV call deactivate
if exist .venv rmdir /s /q .venv

python -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -e . -r apps\api\requirements.txt
```

## 啟動 API

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

確認它活著，並看看它選了哪個裝置：

```cmd
curl -s http://127.0.0.1:8000/health
```

## 啟動 web 控制台

開第二個 Command Prompt：

```cmd
cd apps\web
npm install
npm run dev
```

然後開啟 `http://127.0.0.1:3000`。

## 確認整條路徑可行

在 `.venv` 啟用的狀態下，這個指令不需要任何伺服器就能端到端跑完模型：

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24
```

輸出看起來像逸出位元組是**正確的**。模型還沒訓練過。
[Stage 01](../stages/01-tokens.zh-TW.md) 會說明原因。

## 執行測試

API 有一組合約測試，釘住每個端點與回應結構。任何後端改動前後都應該跑一次：

```cmd
python -m pip install -e .[dev]
python -m pytest
```

會建立 checkpoint 或實驗紀錄的測試在結束後會還原先前狀態，因此執行測試不會污染你自己的訓練歷史。

另外兩個檢查用來防止課程與文件互相漂移：

```cmd
python scripts\check_curriculum.py
python scripts\check_docs.py
```

前者驗證 `curriculum.json`、階段文件與控制台註冊表三者一致；後者驗證所有連結都能解析，
且文件中的 `curl` 範例仍符合資料集註冊表建議的設定。

## 東西會寫到哪裡

| 路徑 | 內容 | 在 git 中 |
| --- | --- | --- |
| `models/checkpoints/` | 訓練好的模型檔 | 否 |
| `models/downloaded/` | GPT-2 權重與 tokenizer 資產 | 否 |
| `models/experiments/` | 訓練執行紀錄 | 否 |
| `data/tiny/`、`data/small/`、`data/medium/`、`data/chat/` | 隨專案附帶的資料集 | 是 |
| `data/external/` | 下載的資料集 | 否 |
| `data/custom/` | 你的 Dataset Builder 範例 | 否 |

因此全新 clone 不會有任何模型與實驗歷史。這是預期的——課程會產生它們。

## 接下來

從 [Stage 01 · Tokens](../stages/01-tokens.zh-TW.md) 開始，或先讀
[課程索引](../README.zh-TW.md)。

CUDA 設定見 [GPU runtime](gpu-runtime.zh-TW.md)。出問題時見
[疑難排解](troubleshooting.zh-TW.md)。
