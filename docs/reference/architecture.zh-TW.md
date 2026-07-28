# Reference · 架構

[English](architecture.md) | [繁體中文](architecture.zh-TW.md)

[課程索引](../README.zh-TW.md)

三個部分如何組合在一起，以及哪個階段教哪一塊。

## 三層

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web        Next.js 控制台 — 學習階梯                   │
│                  用 HTTP 與 API 溝通，從不 import torch      │
├─────────────────────────────────────────────────────────────┤
│  apps/api        FastAPI — 端點、任務、service                │
│                  掌管憑證、裝置選擇與狀態                     │
├─────────────────────────────────────────────────────────────┤
│  packages/llm_core   模型本身 — 純 PyTorch                    │
│                      沒有 FastAPI、沒有 HTTP、沒有專案狀態    │
└─────────────────────────────────────────────────────────────┘
```

依賴方向是嚴格單向的。`llm_core` 對 API 一無所知；API 對瀏覽器一無所知。你可以在沒有任何伺服器
執行的情況下從腳本使用 `llm_core`——`scripts/smoke_chat.py` 與 `scripts/smoke_train.py`
做的正是這件事。

## packages/llm_core

教學核心。每個檔案都小到可以一口氣讀完。

| 模組 | 內容 | 階段 |
| --- | --- | --- |
| `tokenizer.py` | `ByteTokenizer`、`GPT2Tokenizer` | 01 |
| `configs.py` | `ModelConfig`、`MODEL_CONFIGS` | 02 |
| `model.py` | `MultiHeadAttention`、`GELU`、`FeedForward`、`LayerNorm`、`TransformerBlock`、`GPTModel` | 02 |
| `generation.py` | Prompt 樣板、`generate`、逐字稿格式化 | 03, 09 |
| `training.py` | `TrainingConfig`、各種 dataset、`train_tiny_language_model` | 04–06, 10, 12 |
| `checkpoints.py` | 儲存、載入、列出、版本中繼資料 | 07 |
| `gpt2.py` | GPT-2 規格、下載、Hugging Face 權重對應 | 08 |
| `lora.py` | `LoRAConfig`、`LoRALinear`、apply 與 merge | 11 |

`training.py` 中有三個 dataset 類別，各對應一種訓練目標：

| 類別 | 目標 | 目標形狀 |
| --- | --- | --- |
| `TokenDataset` | 純文字／chat 文字 | 每個位置預測下一個 token |
| `InstructionDataset` | Instruction SFT | 在渲染後的 instruction 區塊上預測下一個 token |
| `ChatTranscriptDataset` | Chat SFT | 下一個 token，但 prompt 位置被遮成 `-100` |

## apps/api

FastAPI。`main.py` 只負責組裝應用程式，其餘各有各的位置。

| 模組 | 職責 |
| --- | --- |
| `main.py` | App 中繼資料、CORS、router 註冊——僅此而已 |
| `routers/` | 端點，依課程階段分組 |
| `schemas/` | Pydantic 請求／回應模型，依領域分組 |
| `converters.py` | Pydantic 模型 → service 接受的純 dataclass |
| `dependencies.py` | 行程層級的單例：service、executor、任務註冊表 |
| `jobs/registry.py` | chat、training、pretrained 共用的單一任務生命週期 |

| Service | 職責 |
| --- | --- |
| `chat_service.py` | 已載入模型註冊表、生成、prompt 預覽、串流 |
| `training_service.py` | 訓練執行與實驗紀錄 |
| `dataset_registry.py` | 以宣告式資料描述的資料集階梯 |
| `dataset_inspect.py` | 預覽、split 計數、範例形狀 |
| `experiment_compare.py` | 判斷兩次執行是否可比較 |
| `pretrained_service.py` | GPT-2 下載與註冊 |
| `conversation_service.py` | 記憶體中的會話、context 渲染、預算 |
| `deployment_service.py` | 執行環境概況與資源估算 |
| `external_model_service.py` | 供應商設定與伺服器端呼叫 |

三種任務——chat、training、pretrained——共用一個生命週期
（`queued → running → succeeded | failed | cancelled`），並採合作式取消。
`JobRegistry` 只實作一次；chat 任務不帶 `progress` 清單，因為它本來就沒有。

端點都掛上 `stage:<id>` 的 OpenAPI tag，因此 `/docs` 會自動依課程分組。

所有狀態都在行程記憶體中：已載入的模型、會話與任務紀錄都會在重啟時消失。
只有 checkpoint、下載內容、資料集與實驗紀錄在磁碟上。

## apps/web

一個 Next.js 控制台，它就只是 API 的客戶端。它不含模型程式碼、不含憑證、不含訓練邏輯。
`NEXT_PUBLIC_API_BASE_URL` 是它唯一需要的設定——而且因為帶這個前綴的東西會被編譯進瀏覽器
bundle，那裡也只能放這種等級的值。

## 磁碟上的資料與產出物

| 路徑 | 由誰寫入 | 在 git 中 |
| --- | --- | --- |
| `data/tiny|small|medium|chat/` | 隨 repo 附帶 | 是 |
| `data/external/` | 資料集 prepare 端點 | 否 |
| `data/custom/` | Dataset Builder | 否 |
| `models/downloaded/` | GPT-2 下載任務 | 否 |
| `models/checkpoints/` | 每一次訓練任務 | 否 |
| `models/experiments/` | 實驗紀錄 | 否 |

## 課程碰到程式碼的哪些部分

| Part | 它教的層 |
| --- | --- |
| 1 · Generate | 只有 `llm_core` — tokenizer、模型、生成 |
| 2 · Train | `llm_core` 的訓練與 checkpoint，由 API 驅動 |
| 3 · Reuse | `llm_core/gpt2.py` 加上 pretrained service |
| 4 · Align | `llm_core` 的 dataset 與 LoRA，加上 training service |
| 5 · Ship | API 與 web 層——模型本身不變 |

Part 1–4 建構模型；Part 5 建構模型周圍的系統。這個切分正是依賴箭頭只指向單一方向的原因。
