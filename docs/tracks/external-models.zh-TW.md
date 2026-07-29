# Track · 外部供應商

[English](external-models.md) | [繁體中文](external-models.zh-TW.md)

**選修支線** — 不在階梯上 · [課程索引](../README.zh-TW.md)

## Focus

把你做出來的東西拿去和代管模型比較——並且讓憑證永遠不進到瀏覽器。

## 為什麼這是支線而不是階段

課程中每個階段都替同一個模型疊上一層。這個不是：呼叫別人的 API 不會教你任何關於 tokenizer、
訓練迴圈、checkpoint 或微調的事。

但它仍然值得做一次，理由有兩個。它給你一個參考點，讓你知道一個 136k 參數的模型、
或一個輕度微調的 GPT-2，離正式助理到底有多遠。而且它示範了本專案中唯一真正重要的安全邊界。

在 **Stage 09 · Prompt format** 之後的任何時間都可以做，那時你已經有值得比較的本地模型，
也理解 prompt 是怎麼渲染的。

## Concept

API 只提供兩個真實的供應商插槽。沒有假的供應商——一個假回覆會讓比較失去意義。

| 供應商 | Model id | 呼叫 |
| --- | --- | --- |
| `openai-compatible` | `openai-compatible` | 任何相容 `/chat/completions` 的端點 |
| `ollama` | `ollama-local` | 本機的 Ollama `/api/chat` 端點 |

**憑證邊界才是重點。** 供應商金鑰由 API 行程從環境變數讀取，永遠不離開它。瀏覽器呼叫的是你自己
API 上的 `POST /external/chat`，再由它在伺服器端呼叫供應商。金鑰從不送到前端，
而且任何 `NEXT_PUBLIC_` 變數都不該存放金鑰——帶這個前綴的東西會被編譯進 JavaScript bundle，
形同公開。

`POST /external/prompt-preview` 會在任何東西被送出之前，顯示將被送往供應商的確切內容。
請求帶的是 `messages`、`model`、`max_tokens` 與 `temperature`。注意 `top_k` 會出現在預覽中，
但**不會**被送進相容 OpenAI 的 `/chat/completions` 請求——這是一個小而具體的課題：
供應商 API 與你自己寫的本地生成迴圈並不是同一個介面。

## Run it

### 檢查哪些供應商已設定

```cmd
curl -s http://127.0.0.1:8000/external/models
```

### 設定相容 OpenAI 的端點

在同一個 Command Prompt 中，於啟動 API 之前設定：

```cmd
set CHATOKEN_EXTERNAL_OPENAI_API_KEY=your_api_key
set CHATOKEN_EXTERNAL_OPENAI_MODEL=your_model_name
set CHATOKEN_EXTERNAL_OPENAI_BASE_URL=https://api.openai.com/v1

.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

### 或設定 Ollama

先另外啟動 Ollama 並確認模型已在本機拉下來，然後：

```cmd
set CHATOKEN_EXTERNAL_OLLAMA_ENABLED=true
set CHATOKEN_EXTERNAL_OLLAMA_MODEL=your_local_ollama_model
set CHATOKEN_EXTERNAL_OLLAMA_BASE_URL=http://127.0.0.1:11434

.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

### 預覽外送請求

```cmd
curl -s -X POST http://127.0.0.1:8000/external/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"provider\":\"openai-compatible\",\"model_id\":\"openai-compatible\",\"message\":\"Explain what a checkpoint is.\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"
```

### 用兩條路徑送同一則訊息

```cmd
curl -s -X POST http://127.0.0.1:8000/external/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"provider\":\"openai-compatible\",\"model_id\":\"openai-compatible\",\"message\":\"Explain what a checkpoint is.\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"

curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Explain what a checkpoint is.\",\"model_id\":\"gpt2-instruct-lora\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"
```

### 在控制台

開啟 `http://127.0.0.1:3000`，從 Workbench 抽屜選 **External providers**，或直接前往 `/track/external-models`。

## What to observe

1. **落差很大，而且值得直視。** 代管模型會回答；你的 checkpoint 只是逼近答案的形狀。
   走到這裡，這兩件事都不該讓你意外。
2. **預覽顯示完整的外送內容。** 在資料離開你的機器之前，你可以先讀清楚它是什麼。
3. **任何瀏覽器看得到的回應都不含憑證。** 想的話可以打開 network 分頁檢查——這正是邊界的意義。
4. **`top_k` 會被預覽但不會被送出。** 供應商 API 與你的本地 `generate` 函式不是同一個介面。
5. **延遲與失敗模式都不同。** 網路錯誤、速率限制、按 token 計費，都是本地路徑沒有的成本。

## Exit check

- [ ] 你已經用同一則訊息比較過一個本地 checkpoint 與一個真實供應商。
- [ ] 你能說明為什麼是 API 呼叫供應商，而不是瀏覽器。
- [ ] 你能說出一個無法完整傳到供應商的參數。
- [ ] 你能說出這條支線在建模型這件事上*沒有*教你什麼。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 供應商顯示未設定 | 環境變數在 API 啟動之後才設 | 先設變數，再啟動 uvicorn |
| 供應商回 401 | 金鑰錯誤或過期 | 換新金鑰；絕不要提交進版控 |
| Ollama 連線被拒 | Ollama 沒啟動，或 base URL 錯 | 啟動 Ollama；檢查 11434 埠 |
| 找不到模型 | 模型沒在本機拉下來／帳號無此模型 | `ollama pull <model>`，或檢查供應商的模型清單 |

## Code map

| 內容 | 位置 |
| --- | --- |
| 供應商註冊、環境設定、請求建構 | [`external_model_service.py`](../../apps/api/services/external_model_service.py) |
| `GET /external/models`、`POST /external/prompt-preview`、`POST /external/chat` | [`external.py`](../../apps/api/routers/external.py) |
| 瀏覽器可見的設定 | `apps/web/.env.example` — 只放 `NEXT_PUBLIC_`，絕不放機密 |

## 回到課程

[課程索引](../README.zh-TW.md)
