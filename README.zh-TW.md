# Chatoken

[English](README.md) | [繁體中文](README.zh-TW.md)

Chatoken 是一個教學型專案，用來從零開始建立一個最小版的 ChatGPT 類系統。它從一個 tiny PyTorch
GPT 模型開始，接出 AI API 後端，並驅動一個 Next.js Web 控制台——完整走過從隨機權重、訓練、
微調到服務的整條路徑。

目標不是做出一個強大的助理，而是照順序走完這條路，一次一個觀念，並理解每一步。

## → [開始課程](docs/README.zh-TW.md)

五個部分、十七個階段。每個階段只教一個新觀念，並疊在前一個之上：

| Part | 階段 | 你會得到什麼 |
| --- | --- | --- |
| 1 · Generate | 01–03 | 一個會產生 token 的模型 |
| 2 · Train | 04–07 | 一個從你的資料學到東西、並存成 checkpoint 的模型 |
| 3 · Reuse | 08–09 | 在同一份程式碼中跑起來的 pretrained GPT-2 |
| 4 · Align | 10–14 | Instruction tuning、LoRA、chat tuning、你自己的資料集、評估 |
| 5 · Ship | 15–17 | 會話、串流，以及一套部署成本模型 |

所有文件都有英文與繁體中文版本。

## 安裝設定

所有 Python 指令都在專案本地的 `.venv` 內執行。請使用 Windows Command Prompt（`cmd.exe`）
搭配 Windows CPython **3.11、3.12 或 3.13**——不要用 3.14，因為在這個環境下沒有對應的
PyTorch wheel。

```cmd
where python
python --version

python -m venv .venv
.venv\Scripts\activate.bat

python -m pip install --upgrade pip
python -m pip install -e . -r apps\api\requirements.txt
```

完整說明（包含如何重建以錯誤 Python 版本建立的 venv）在
[安裝設定](docs/reference/setup.zh-TW.md)。

## 執行

啟動 API：

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

在第二個 Command Prompt 啟動 web 控制台：

```cmd
cd apps\web
npm install
npm run dev
```

然後開啟 `http://127.0.0.1:3000`。

## 確認可以運作

這個指令不需要任何伺服器就能端到端跑完模型：

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24
```

輸出看起來像逸出位元組是**正確的**——模型還沒訓練過。
[Stage 01](docs/stages/01-tokens.zh-TW.md) 會說明原因，課程也從那裡往下走。

## 專案結構

| 路徑 | 內容 |
| --- | --- |
| `packages/llm_core` | 模型本身：tokenizer、GPT 架構、生成、訓練、checkpoint、LoRA |
| `apps/api` | FastAPI 後端——端點、任務、service |
| `apps/web` | Next.js 學習控制台 |
| `scripts` | 不需要伺服器的生成與訓練 smoke test |
| `data` | 資料集，從 4 行的小檔案到散文與 instruction 資料 |
| `models` | Checkpoint、下載的 GPT-2 權重、實驗紀錄（全部被 git 忽略） |
| `docs` | 課程、選修支線與參考資料 |

[架構](docs/reference/architecture.zh-TW.md) 說明這三層如何組合在一起。

## 文件

- [課程索引](docs/README.zh-TW.md) — 有序路徑，從這裡開始
- [安裝設定](docs/reference/setup.zh-TW.md) · [GPU runtime](docs/reference/gpu-runtime.zh-TW.md) ·
  [API](docs/reference/api.zh-TW.md) · [架構](docs/reference/architecture.zh-TW.md) ·
  [名詞表](docs/reference/glossary.zh-TW.md) · [疑難排解](docs/reference/troubleshooting.zh-TW.md)
- [外部供應商支線](docs/tracks/external-models.zh-TW.md) — 選修
- [架構重整規劃](docs/restructure-plan.zh-TW.md) — 為什麼專案是這樣組織的
