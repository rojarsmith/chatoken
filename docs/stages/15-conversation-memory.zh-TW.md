# Stage 15 · Conversation memory

[English](15-conversation-memory.md) | [繁體中文](15-conversation-memory.zh-TW.md)

**Part 5 · Ship** — 17 個階段中的第 15 個 · [課程索引](../README.zh-TW.md)

## Focus

模型是無狀態的。記憶由應用程式提供。

## Prerequisites

- **Stage 14 · Compare runs** — 模型的工作已經完成。從這裡開始，主題是模型周圍的系統。

## Concept

你建的東西沒有任何一個會記住任何事。`generate` 收下一個 id 張量，回傳一個更長的。
兩次呼叫之間，模型什麼都沒留下。

在聊天產品中感覺像記憶的一切，都是應用程式在每一輪重新送出歷史：

```
第 3 輪請求
  = system prompt
  + 第 1 輪 user + 第 1 輪 assistant
  + 第 2 輪 user + 第 2 輪 assistant
  + 第 3 輪 user
  -> 渲染成一個字串 -> tokenize -> generate
```

有兩個彼此獨立的限制決定多少歷史能存活，混淆它們是絕大多數「模型忘記了」問題的來源：

**應用程式的預算** — `max_history_messages`（渲染最近幾則訊息）與 `context_token_budget`
（渲染器套用的 token 上限）。這些是你的政策。

**模型真正的視窗** — `context_length`，來自 Stage 02 position embedding 表的硬性架構限制。
`random-tiny-byte` 是 **64 個 token**；GPT-2 是 1,024。

API 可以存一百則訊息。如果模型的視窗只有 64 個 token，它注意得到的大約只有最後一句話。
`POST /conversations/{id}/context-preview` 的存在就是為了在你送出之前把這個落差攤開：
它回報確切的逐字稿、`prompt_tokens`、預算、模型的 `context_length`、被歷史上限丟掉的訊息、
被 token 預算丟掉的訊息，以及當逐字稿超過模型實際可見範圍時的警告。

有兩種渲染格式：

| 格式 | 送出什麼 |
| --- | --- |
| `chat-transcript` | 直接送 `System:` / `User:` / `Assistant:` 各行 |
| `instruction-request` | 把整段會話包成一道指令，要求回覆最新的訊息 |

格式要對應模型被訓練的方式：Stage 12 的 `gpt2-chat-lora` 用 `chat-transcript`；
Stage 10、11、13 的 instruction 微調 checkpoint 用 `instruction-request`。

會話存在行程記憶體中，API 重啟就會清空。這對教學原型是刻意的；正式版本會加上持久化儲存、
帳號、驗證、速率限制，可能還有以摘要為基礎的長期記憶。

## Run it

### 建立會話

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Memory smoke test\",\"model_id\":\"random-tiny-byte\",\"system_prompt\":\"You are a concise assistant.\",\"max_history_messages\":8,\"context_token_budget\":256,\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

### 送出一個事實

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/<CONVERSATION_ID>/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"My name is Rojar. Please remember it.\",\"model_id\":\"random-tiny-byte\",\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"inference_mode\":\"greedy\"}"
```

### 問回來之前先預覽

這是本階段最重要的一次呼叫：

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/<CONVERSATION_ID>/context-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"What is my name?\",\"model_id\":\"random-tiny-byte\",\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"inference_mode\":\"greedy\"}"
```

### 換一個有真正視窗的模型再做一次

把上面三個呼叫改成 `"model_id":"gpt2-chat-lora"`，然後比較兩次預覽。

### 管理會話

```cmd
curl -s http://127.0.0.1:8000/conversations
curl -s http://127.0.0.1:8000/conversations/<CONVERSATION_ID>
curl -s -X DELETE http://127.0.0.1:8000/conversations/<CONVERSATION_ID>
```

### 在控制台

> 階段階梯會在重整的 Phase 2 出現。在那之前，這位於 legacy 頁籤 **Conversation**。

## What to observe

1. **預覽顯示整個 prompt**，包含 system 那一行。沒有任何東西對你隱藏、卻對模型顯示。
2. **`random-tiny-byte` 幾乎丟掉一切。** 在 `context_length=64` 之下，儲存的逐字稿遠超過模型
   能注意到的範圍，而警告會這麼說。
3. **會回報兩個不同的省略數量** — 歷史上限與 token 預算。它們是各自獨立的政策，可以分別觸發。
4. **調高 `max_history_messages` 不會調高 `context_length`。** 應用程式政策無法超越架構。
   試一次，看著警告依然存在。
5. **每則儲存的訊息都記錄產生它的模型。** 會話中途換模型不會改寫舊的輪次——標記會顯示混合歷史。
6. **重啟 API 會清空一切。** 記憶體儲存，一開始就說明了。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能說明模型在什麼都沒儲存的情況下為何看起來像有記憶。
- [ ] 你能說出兩個應用程式限制與一個架構限制。
- [ ] 你預覽過一段被截斷的 context，並能指出是哪個限制造成的。
- [ ] 你能把 context 格式對應到一個 checkpoint 的訓練方式。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 模型立刻「忘記」 | tiny 模型的 `context_length` 是 64 | 改用 GPT-2 checkpoint；這是架構，不是 bug |
| 回覆忽略 system prompt | base GPT-2 從未被訓練去遵守它 | 用 `gpt2-chat-lora`；見 Stage 12 |
| 會話消失 | API 重啟過 | 記憶體儲存，設計如此 |
| 答案離題或重複 | 弱模型上的 greedy 解碼 | 早期階段的預期行為；回顧 Stage 03 與 09 |
| 格式不符導致亂答 | 把 `instruction-request` 送給 chat 訓練的模型 | 讓格式對應訓練方式 |

## Code map

| 內容 | 位置 |
| --- | --- |
| 會話儲存、歷史／預算政策、預覽 | [`conversation_service.py`](../../apps/api/services/conversation_service.py) |
| 逐字稿渲染 | [`generation.py`](../../packages/llm_core/llm_core/generation.py) → `format_chat_transcript` |
| 硬性 context 限制 | [`model.py`](../../packages/llm_core/llm_core/model.py) → `forward` 中的 `pos_emb` 邊界 |
| Conversation 端點 | [`apps/api/main.py`](../../apps/api/main.py) |

## Next stage

[**Stage 16 · Streaming & cancel**](16-streaming-cancel.zh-TW.md) — 答案是對的，
但它一次全部到達，而且沒有東西能中止它。
