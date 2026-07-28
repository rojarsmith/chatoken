# 外部模型整合

[English](external-model-integration.md) | [繁體中文](external-model-integration.zh-TW.md)

這個階段把學習後端接到 provider-backed models，但不取代本地學習路徑。

目標是比較：

```text
same message -> local model -> local reply
same message -> external provider -> external reply
```

Web UI 使用 `External` 分頁。API key 只保存在 API server 的環境變數中，瀏覽器端不會拿到 provider credential。

## Providers

後端只提供真正會呼叫模型的 provider slot。這個 prototype 不再提供 mock provider，因為 assistant reply 應該來自即時模型推論或真 provider 呼叫。

| Provider | Model id | 用途 |
| --- | --- | --- |
| `openai-compatible` | `openai-compatible` | 從 API server 呼叫相容 `/chat/completions` 的 endpoint。 |
| `ollama` | `ollama-local` | 從 API server 呼叫本機 Ollama `/api/chat` endpoint。 |

檢查 provider 狀態：

```cmd
curl -s http://127.0.0.1:8000/external/models
```

## 設定 OpenAI-Compatible Endpoint

在 Windows Command Prompt 啟動 API 前設定環境變數：

```cmd
set CHATOKEN_EXTERNAL_OPENAI_API_KEY=your_api_key
set CHATOKEN_EXTERNAL_OPENAI_MODEL=your_model_name
set CHATOKEN_EXTERNAL_OPENAI_BASE_URL=https://api.openai.com/v1

.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

然後呼叫：

```cmd
curl -s -X POST http://127.0.0.1:8000/external/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"provider\":\"openai-compatible\",\"model_id\":\"openai-compatible\",\"message\":\"Explain what a checkpoint is.\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"
```

後端會送出：

- `messages`
- `model`
- `max_tokens`
- `temperature`

如果選了 `top_k`，preview 會顯示它，但 OpenAI-compatible `/chat/completions` request 不會送出 `top_k`。

## 設定 Ollama

先另外啟動 Ollama，並確認本機已有該模型，再用以下環境變數啟動 API：

```cmd
set CHATOKEN_EXTERNAL_OLLAMA_ENABLED=true
set CHATOKEN_EXTERNAL_OLLAMA_MODEL=your_local_ollama_model
set CHATOKEN_EXTERNAL_OLLAMA_BASE_URL=http://127.0.0.1:11434

.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

然後呼叫：

```cmd
curl -s -X POST http://127.0.0.1:8000/external/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"provider\":\"ollama\",\"model_id\":\"ollama-local\",\"message\":\"Explain what a checkpoint is.\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"
```

## Web UI 學習檢查

1. 設定 OpenAI-compatible 或 Ollama 環境變數並重啟 API。
2. 打開 `External`。
3. 選擇已 configured 的 provider-backed model。
4. 選一個 local model，例如 `random-tiny-byte` 或已載入的 checkpoint。
5. 按 `Preview`，檢查 rendered prompt 和 provider `messages` payload。
6. 按 `Compare`，確認 local side 與 external side 被清楚分開。

這個階段要學到一個重要邊界：外部模型是有用的 baseline，但它們不會解釋本地 GPTModel、tokenizer、training loop、checkpoint 或 fine-tuning 如何運作。它們是比較對象，不是 from-scratch 路徑的替代品。
