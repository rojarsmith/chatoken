# 多輪對話與會話記憶

[English](conversation-memory.md) | [繁體中文](conversation-memory.zh-TW.md)

這個學習階段加入類似 ChatGPT 的多輪會話 wiring。重點是看懂「API 如何保存訊息」以及「模型實際看到哪些 context」。

後端目前會把 conversation 存在記憶體中：

```text
conversation session
-> user message
-> assistant reply
-> next user message
-> rendered prompt
-> local model generation
```

最重要的觀念是：「API 記得訊息」和「模型能正確使用訊息」不是同一件事。API 可以保存很多 messages，但模型只看得到最後被渲染出來、且放得進 context budget 與模型實際 `context_length` 的 prompt。

## Web UI

打開 `Conversation` 分頁。

預設模型是 `random-tiny-byte`。它是真正會在送出時即時計算的 PyTorch 模型，但它是隨機初始化，所以不會像 ChatGPT。本機 ChatGPT-like 學習路徑請先完成 [最小 GPU Chat Model](minimal-chat-model.zh-TW.md)，載入 `gpt2-chat-lora`，再搭配 `Chat transcript`。

可以控制：

- `System prompt`：放在對話前面的高階行為指令。
- `Context format`：把已保存 turns 渲染成 prompt 的方式。
- `Chat transcript`：直接送出 `System:`、`User:`、`Assistant:` 逐字稿。
- `Instruction request`：把整個 session 包成一個 instruction，要求模型回答最新 user message。
- `History messages`：要渲染最近幾筆已保存 messages。
- `Context token budget`：conversation renderer 使用的邏輯 token budget。
- `Max new tokens`：回答長度。
- `Inference mode`、`temperature`、`top_k`：解碼行為。

送出前先按 `Preview context`。Preview 會顯示：

- 真正送進 local model 的 prompt
- prompt tokens
- 選定的 context budget
- 模型的 `context_length`
- 因 history limit 被省略的 messages
- 因 token budget 被省略的 messages
- 選到 random model、base GPT-2、或 prompt format 不匹配時的 warnings
- prompt 超過模型實際可注意 context 時的 warnings

每一則 message 也會顯示當時使用的 model。這很重要：如果你在同一個 session 內切換模型，頁面上方顯示的是目前設定，但舊的 assistant 回覆可能是先前模型產生的。

## API

啟動 API：

```cmd
.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

建立 conversation：

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/conversations -H "Content-Type: application/json" -d "{\"title\":\"Memory smoke test\",\"model_id\":\"random-tiny-byte\",\"system_prompt\":\"You are a concise assistant.\",\"max_history_messages\":8,\"context_token_budget\":256,\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"temperature\":0,\"inference_mode\":\"greedy\"}" ^| python -c "import sys,json; print(json.load(sys.stdin)['conversation_id'])"') do set CONVERSATION_ID=%i
```

送出第一輪：

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/%CONVERSATION_ID%/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"My name is Rojar. Please remember it.\",\"model_id\":\"random-tiny-byte\",\"system_prompt\":\"You are a concise assistant.\",\"max_history_messages\":8,\"context_token_budget\":256,\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

預覽第二輪會用到的 context：

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/%CONVERSATION_ID%/context-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"What is my name?\",\"model_id\":\"random-tiny-byte\",\"system_prompt\":\"You are a concise assistant.\",\"max_history_messages\":8,\"context_token_budget\":256,\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

再送出第二輪：

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/%CONVERSATION_ID%/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"What is my name?\",\"model_id\":\"random-tiny-byte\",\"system_prompt\":\"You are a concise assistant.\",\"max_history_messages\":8,\"context_token_budget\":256,\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

列出 conversations：

```cmd
curl -s http://127.0.0.1:8000/conversations
```

## 觀察重點

1. session 會保存 user 和 assistant messages。
2. rendered prompt 會包含前面的 turns，直到 history 或 token budget 把它們移除。
3. `random-tiny-byte` 的 `context_length=64`，所以即使 API transcript 含有前文，模型也可能只能注意最後 64 個 byte tokens。
4. 載入 GPT-2 後，context window 會大很多，同一個 session 行為比較有學習價值。
5. 如果模型沒有訓練過 instruction-following，就算 context 正確，也可能無法自然回答。

## 為何回答會重複或偏離

這在早期學習階段是預期現象：

- `random-tiny-byte` 是隨機初始化模型。它使用 byte tokenizer，遇到無效 UTF-8 時會顯示 `\xc0` 這類 escape text；greedy 解碼也會反覆選到同一個最高分 byte pattern。
- 下載的 `gpt2-124M` 是 pretrained next-token model。它會續寫文字，但不是 ChatGPT 這類 instruction/chat model，所以可能不理會 `System/User/Assistant` 結構。
- 切換 model selector 不會重寫舊訊息。請看每則 message 上的 model badge，確認那則回覆是哪個模型產生。
- 對 base GPT-2 來說，兩種格式都不會讓它突然變成真正聊天助理。若要測試本機 chat fine-tuning，請用 `gpt2-chat-lora` 搭配 `Chat transcript`；若要更強行為，請用真正的 external chat provider。

## 目前範圍

Conversation sessions 只存在記憶體。重啟 API 後會清空。

這是教學 prototype 的刻意選擇。production 版本會再加入 persistent storage、user accounts、auth、rate limits、streaming conversation turns，以及可能的 summary-based long-term memory。
