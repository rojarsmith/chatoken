# Stage 16 · Streaming & cancel

[English](16-streaming-cancel.md) | [繁體中文](16-streaming-cancel.zh-TW.md)

**Part 5 · Ship** — 17 個階段中的第 16 個 · [課程索引](../README.zh-TW.md)

## Focus

token 是一個一個到的，而使用者必須能中止。

## Prerequisites

- **Stage 15 · Conversation memory** — 你有一個能運作的多輪會話，但它會一直卡住直到整個答案
  完成為止。

## Concept

Stage 03 已經確立生成是一個每次迭代產生一個 token 的迴圈。到目前為止每個端點都把這件事藏起來：
請求會一直阻塞到迴圈結束，然後一次回傳全部。對 CPU 上一個 80 token 的答案來說，那是一段很長的沉默。

**串流**把那個一直都在的迴圈攤開。`POST /chat/stream` 回傳以換行分隔的 JSON——
每行一個事件，發生時就送出：

```json
{"event":"start","model_id":"random-tiny-byte","prompt_tokens":31}
{"event":"token","delta":"A","reply":"A","tokens_generated":1}
{"event":"done","result":{"model_id":"random-tiny-byte","reply":"..."}}
```

每個 `token` 事件同時帶著 `delta`（新增的部分）與目前為止的 `reply`，所以客戶端可以選擇
附加或整段取代。這裡沒有任何新的模型能力——同一個迴圈，只是即時回報。

**取消**是合作式的，不是強制的。有三個端點：

```
POST /chat/jobs/{job_id}/cancel
POST /training/jobs/{job_id}/cancel
POST /pretrained/jobs/{job_id}/cancel
```

每個都會把 `cancel_requested` 設成 `true`。接下來發生什麼，取決於任務當時的狀態：

| 取消時的狀態 | 結果 |
| --- | --- |
| `queued` | 立即變成 `cancelled`——它根本還沒開始 |
| `running` | 繼續跑到下一個安全檢查點，然後停下並記為 `cancelled` |

API 從不砍執行緒或行程。在訓練迴圈中，`_raise_if_cancelled` 在每步之間被檢查，
所以被取消的執行會停在兩次最佳化更新之間，而不是停在某次更新的中途。這讓模型狀態、
開啟中的檔案與開發伺服器都保持完整——代價是取消不是瞬間的，遇到很慢的步驟你就得等它。

這是取捨的通用形狀：強制終止快而不安全；合作式取消安全但稍微慢一點。正式系統壓倒性地選擇後者。

## Run it

### 看著 token 抵達

`-N` 關閉 curl 的緩衝，這正是這裡的重點：

```cmd
curl -N -s -X POST http://127.0.0.1:8000/chat/stream ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"message\":\"Every effort moves you\",\"max_new_tokens\":12,\"temperature\":0}"
```

與阻塞端點對照——相同結果，不同的傳遞方式：

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"message\":\"Every effort moves you\",\"max_new_tokens\":12,\"temperature\":0}"
```

### 取消一個排隊中的任務

啟動一個長時間訓練，然後立刻取消：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"the-verdict\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"cancel-test\",\"max_steps\":2000,\"eval_every\":50,\"block_size\":64}"

curl -s -X POST "http://127.0.0.1:8000/training/jobs/<JOB_ID>/cancel"
curl -s "http://127.0.0.1:8000/training/jobs/<JOB_ID>"
```

### 取消一個執行中的任務

啟動同樣的任務，等到 `status` 變成 `running` 再取消並輪詢。量一下它要多久才變成 `cancelled`。

### 在控制台

> 階段階梯會在重整的 Phase 2 出現。在那之前，串流位於 legacy 頁籤 **Chat**，
> 取消按鈕出現在訓練與 GPT-2 面板上。

## What to observe

1. **第一個 `token` 事件遠早於答案完成就抵達。** 感知延遲下降，但總時間完全沒變。
2. **`start` 在任何生成之前就帶著 `prompt_tokens`。** 客戶端可以立刻顯示 context 成本。
3. **被取消的 `queued` 任務立刻翻轉**；被取消的 `running` 任務要等到下一個步驟邊界。
   兩個都量一次——差別就是本階段的重點。
4. **`cancel_requested` 在狀態仍是 `running` 時就看得到。** 旗標與狀態是兩回事。
5. **被取消的訓練任務不會寫出 checkpoint。** 取消發生在儲存之前。
6. **串流不會改變輸出。** 在 `temperature 0` 下，串流與阻塞呼叫產生完全相同的文字。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能說出 `/chat/stream` 的三種事件類型以及各自帶什麼。
- [ ] 你能說明為什麼取消是合作式而非強制式。
- [ ] 你已經取消過排隊中與執行中的任務各一次，並觀察到時間差。
- [ ] 你能說出串流改變了什麼、沒有改變什麼。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 串流一次全部到達 | curl 緩衝 | 加上 `-N` |
| 取消回 404 | job id 錯誤，或任務已結束 | 先輪詢任務 |
| 執行中的任務要好幾秒才取消 | 目前這一步必須跑完 | 預期行為——這就是「合作式」的意思 |
| 被取消的任務顯示 `failed` | worker 在檢查取消之前就丟出例外 | 讀 `error` 欄位 |

## Code map

| 內容 | 位置 |
| --- | --- |
| `POST /chat/stream` 與 NDJSON 事件 | [`apps/api/main.py`](../../apps/api/main.py) → `stream_chat` |
| 供串流使用的逐 token 生成 | [`chat_service.py`](../../apps/api/services/chat_service.py) |
| 取消端點與旗標處理 | `main.py` 中的 `_cancel_chat_job`、`_cancel_training_job`、`_cancel_pretrained_job` |
| 訓練中的取消檢查 | [`training.py`](../../packages/llm_core/llm_core/training.py) → `_raise_if_cancelled` |

## Next stage

[**Stage 17 · Deploy & limits**](17-deploy-limits.zh-TW.md) — 最後一個階段：
當不只一個人使用時，這一切要花多少成本。
