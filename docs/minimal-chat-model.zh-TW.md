# 最小 GPU Chat Model

[English](minimal-chat-model.md) | [繁體中文](minimal-chat-model.zh-TW.md)

這個階段會從下載好的 pretrained GPT-2 開始，訓練一個最小的 ChatGPT-like 雛形：

```text
下載 GPT-2 -> 用 chat transcript 訓練 LoRA -> 儲存 full checkpoint -> 在 Conversation 用模型即時推論
```

目標不是做出 production 助理，而是補上目前缺少的學習階段：base next-token model 必須看過 chat 格式資料，才比較可能根據多輪上下文回答最新訊息。

## 這個階段新增什麼

- Dataset：`chat-sft-lora`
- Base model：`gpt2-124M`
- Training objective：`chat-lora`
- Output model：`gpt2-chat-lora`
- Conversation format：`chat-transcript`
- Training target：只對 assistant response tokens 計算 loss；system/user/history tokens 是上下文，不是答案本文。

## 為什麼要 GPU

LoRA 只訓練少量參數，但每個 step 仍然要跑 GPT-2 的 forward/backward。CPU 可以做極短 smoke test，但合理的訓練體驗應該使用 CUDA。

在專案 `.venv` 內確認 CUDA：

```cmd
.venv\Scripts\activate.bat
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu')"
```

在同一個已啟用 `.venv` 的終端啟動 API：

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

確認 runtime：

```cmd
curl -s http://127.0.0.1:8000/health
```

## 用 API 訓練

載入 GPT-2 small：

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/pretrained/jobs -H "Content-Type: application/json" -d "{\"model_size\":\"124M\",\"model_id\":\"gpt2-124M\"}" ^| python -c "import sys,json; print(json.load(sys.stdin)['job_id'])"') do set GPT2_JOB_ID=%i

curl -s "http://127.0.0.1:8000/pretrained/jobs/%GPT2_JOB_ID%"
```

啟動 chat LoRA 訓練：

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/training/jobs -H "Content-Type: application/json" -d "{\"dataset_id\":\"chat-sft-lora\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-chat-lora\",\"max_steps\":240,\"batch_size\":1,\"block_size\":384,\"learning_rate\":0.0003,\"eval_every\":10,\"sample_prompt\":\"who are you?\",\"load_when_complete\":true}" ^| python -c "import sys,json; print(json.load(sys.stdin)['job_id'])"') do set CHAT_TRAINING_JOB_ID=%i

curl -s "http://127.0.0.1:8000/training/jobs/%CHAT_TRAINING_JOB_ID%"
```

持續查詢 training job，直到 `status` 變成 `succeeded`。

## 測試多輪對話

建立 session：

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/conversations -H "Content-Type: application/json" -d "{\"title\":\"Chat LoRA smoke\",\"model_id\":\"gpt2-chat-lora\",\"system_prompt\":\"You are Chatoken, a concise assistant for a learning console.\",\"max_history_messages\":8,\"context_token_budget\":512,\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}" ^| python -c "import sys,json; print(json.load(sys.stdin)['conversation_id'])"') do set CONVERSATION_ID=%i
```

送出記憶訊息：

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/%CONVERSATION_ID%/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"My name is Rojar. Please remember it.\",\"model_id\":\"gpt2-chat-lora\",\"system_prompt\":\"You are Chatoken, a concise assistant for a learning console.\",\"max_history_messages\":8,\"context_token_budget\":512,\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

根據上下文詢問：

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/%CONVERSATION_ID%/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"What is my name?\",\"model_id\":\"gpt2-chat-lora\",\"system_prompt\":\"You are Chatoken, a concise assistant for a learning console.\",\"max_history_messages\":8,\"context_token_budget\":512,\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

## Web UI 流程

1. 打開 `GPT-2`，載入 `GPT-2 small`。
2. 打開 `Chat SFT`。
3. 確認 dataset 是 `chat-sft-lora`，base model 是 `gpt2-124M`，output model 是 `gpt2-chat-lora`。
4. 確認頂部 runtime 顯示 CUDA。
5. 開始訓練，等待 job 成功。
6. 打開 `Conversation`。
7. 選擇 `gpt2-chat-lora`。
8. 使用 `Chat transcript`。
9. 送出 `My name is Rojar. Please remember it.`
10. 再送出 `What is my name?`

## 預期限制

這個 checkpoint 只用很小的本地資料訓練。它應該會比 raw GPT-2 更能展示 chat 格式與短 session 記憶，但仍然會在很多開放式問題上失敗。要得到更接近 ChatGPT 的效果，需要更多 chat data、更多訓練步數、更強的 base model，以及符合目標行為的 eval examples。
