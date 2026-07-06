# Streaming Chat 與取消任務

[English](streaming-chat-cancel.md) | [繁體中文](streaming-chat-cancel.zh-TW.md)

這個階段新增兩個真實 chat 系統會需要的 runtime 行為：

- streaming chat output：完整答案完成前，就先看到 token 逐步到達；
- queued 或 running job 可以取消。

這裡的實作刻意保持教學用途的簡單性。Streaming 使用 newline-delimited JSON events，
取消任務則採用 cooperative cancellation。

## Streaming Chat

Endpoint：

```text
POST /chat/stream
```

每一行 response 都是一個 JSON event：

```json
{"event":"start","model_id":"random-tiny-byte","prompt_tokens":31}
{"event":"token","delta":"A","reply":"A","tokens_generated":1}
{"event":"done","result":{"model_id":"random-tiny-byte","reply":"..."}}
```

在 Windows Command Prompt smoke test：

```cmd
curl -N -s -X POST http://127.0.0.1:8000/chat/stream ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"message\":\"Every effort moves you\",\"max_new_tokens\":12,\"temperature\":0}"
```

Web UI 的 Chat view 現在會讀取這個 stream，並在 token event 到達時更新輸出。

## Cancel Endpoints

```text
POST /chat/jobs/{job_id}/cancel
POST /training/jobs/{job_id}/cancel
POST /pretrained/jobs/{job_id}/cancel
```

範例：

```cmd
curl -s -X POST "http://127.0.0.1:8000/training/jobs/%TRAINING_JOB_ID%/cancel"
```

回傳的 job 會有 `cancel_requested=true`。如果 job 還在 queued，status 會立刻變成
`cancelled`。如果 job 已經 running，worker 會在下一個安全檢查點停止，然後記錄
`status=cancelled`。

## 學習重點

Streaming 和 cancellation 是 runtime coordination 功能。
它們不會改變模型權重，也不會直接改善模型品質。

Streaming 改變的是 token 交付方式：

```text
generate one token -> emit event -> update UI -> continue
```

Cancellation 改變的是長任務如何與 API 協作：

```text
user clicks Cancel -> API sets cancel_requested -> worker checks flag -> worker exits safely
```

API 不會硬殺 Python process 或 worker thread。這樣對模型狀態、檔案與本機開發伺服器比較安全。
