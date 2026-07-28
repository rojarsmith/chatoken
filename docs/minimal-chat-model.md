# Minimal GPU Chat Model

[English](minimal-chat-model.md) | [繁體中文](minimal-chat-model.zh-TW.md)

This stage trains a tiny ChatGPT-like prototype from a downloaded pretrained GPT-2 base:

```text
download GPT-2 -> train LoRA on chat transcripts -> save full checkpoint -> use Conversation with live model inference
```

The goal is not to create a production assistant. The goal is to make the missing learning step visible: a base next-token model must be trained on chat-shaped data before it can reliably answer from multi-turn context.

## What Changes

- Dataset: `chat-sft-lora`
- Base model: `gpt2-124M`
- Training objective: `chat-lora`
- Output model: `gpt2-chat-lora`
- Conversation format: `chat-transcript`
- Training target: assistant response tokens only; system/user/history tokens are context, not answer text.

## Why GPU

LoRA trains far fewer parameters than full SFT, but every step still runs GPT-2 forward and backward passes. CPU can run a very short smoke test, but use CUDA for a reasonable loop.

Check CUDA from the project `.venv`:

```cmd
.venv\Scripts\activate.bat
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu')"
```

Start the API in the same activated environment:

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

Check the runtime:

```cmd
curl -s http://127.0.0.1:8000/health
```

## Train by API

Load GPT-2 small:

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/pretrained/jobs -H "Content-Type: application/json" -d "{\"model_size\":\"124M\",\"model_id\":\"gpt2-124M\"}" ^| python -c "import sys,json; print(json.load(sys.stdin)['job_id'])"') do set GPT2_JOB_ID=%i

curl -s "http://127.0.0.1:8000/pretrained/jobs/%GPT2_JOB_ID%"
```

Start chat LoRA training:

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/training/jobs -H "Content-Type: application/json" -d "{\"dataset_id\":\"chat-sft-lora\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-chat-lora\",\"max_steps\":240,\"batch_size\":1,\"block_size\":384,\"learning_rate\":0.0003,\"eval_every\":10,\"sample_prompt\":\"who are you?\",\"load_when_complete\":true}" ^| python -c "import sys,json; print(json.load(sys.stdin)['job_id'])"') do set CHAT_TRAINING_JOB_ID=%i

curl -s "http://127.0.0.1:8000/training/jobs/%CHAT_TRAINING_JOB_ID%"
```

Poll the training job until `status` becomes `succeeded`.

## Test Multi-Turn Conversation

Create a session:

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/conversations -H "Content-Type: application/json" -d "{\"title\":\"Chat LoRA smoke\",\"model_id\":\"gpt2-chat-lora\",\"system_prompt\":\"You are Chatoken, a concise assistant for a learning console.\",\"max_history_messages\":8,\"context_token_budget\":512,\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}" ^| python -c "import sys,json; print(json.load(sys.stdin)['conversation_id'])"') do set CONVERSATION_ID=%i
```

Send a memory turn:

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/%CONVERSATION_ID%/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"My name is Rojar. Please remember it.\",\"model_id\":\"gpt2-chat-lora\",\"system_prompt\":\"You are Chatoken, a concise assistant for a learning console.\",\"max_history_messages\":8,\"context_token_budget\":512,\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

Ask from context:

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/%CONVERSATION_ID%/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"What is my name?\",\"model_id\":\"gpt2-chat-lora\",\"system_prompt\":\"You are Chatoken, a concise assistant for a learning console.\",\"max_history_messages\":8,\"context_token_budget\":512,\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

## Web UI Flow

1. Open `GPT-2` and load `GPT-2 small`.
2. Open `Chat SFT`.
3. Confirm dataset `chat-sft-lora`, base model `gpt2-124M`, output model `gpt2-chat-lora`.
4. Confirm the top bar shows CUDA.
5. Start training and wait for the job to succeed.
6. Open `Conversation`.
7. Select `gpt2-chat-lora`.
8. Use `Chat transcript`.
9. Send `My name is Rojar. Please remember it.`
10. Send `What is my name?`

## Expected Limits

This checkpoint is trained on a very small local dataset. It should demonstrate chat formatting and short session memory better than raw GPT-2, but it will still fail many open-ended questions. Better behavior requires more chat data, more training steps, stronger base models, and eval examples that match the behavior you want.
