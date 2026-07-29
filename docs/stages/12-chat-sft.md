# Stage 12 · Chat SFT

[English](12-chat-sft.md) | [繁體中文](12-chat-sft.zh-TW.md)

**Part 4 · Align** — Stage 12 of 17 · [Course index](../README.md)

## Focus

Multi-turn transcripts teach turn-taking — and the loss should only cover the assistant's
words.

## Prerequisites

- **Stage 11 · LoRA** — you can freeze a base model and train adapters, and you understand
  why the result saves as a full checkpoint.

## Concept

Stage 10 taught single-turn answering: one instruction in, one response out. A conversation
needs something more — the model must read a *history* and produce only the next assistant
turn.

The `chat-sft-lora` dataset holds multi-turn transcripts. `ChatTranscriptDataset` splits each
transcript into (prompt, response) pairs, where the prompt is everything said so far and the
response is the next assistant message.

The new idea is what happens to the targets:

```
tokens:   System: ... User: ... Assistant:   A nice reply here
targets:  -100  -100  -100  -100  -100  -100  A  nice  reply  here  <eos>
          └────────── ignored ──────────┘   └──── loss applies ────┘
```

Prompt positions are set to `-100`, which PyTorch's `cross_entropy` skips. **The model is
never rewarded for predicting the user's words.** Without this masking, the model would spend
most of its capacity learning to generate plausible user turns — which is exactly the failure
you saw from base GPT-2 in Stage 08, where asking a question produced more questions.

The rest of the recipe is Stage 11's, with heavier settings:

| Setting | Stage 11 (instruction) | Stage 12 (chat) |
| --- | --- | --- |
| `max_steps` | 20 | 240 |
| `block_size` | 256 | 384 |
| `learning_rate` | 3e-4 | 3e-4 |
| Objective | `instruction-lora` | `chat-lora` |
| Prompt style | `instruction` | `chat` |
| Output | `gpt2-instruct-lora` | `gpt2-chat-lora` |

The longer window holds several turns of history. The larger step count reflects a harder
target: turn structure has to be learned, not just answer shape.

Also note the truncation policy. When a transcript is too long, prompt tokens are dropped from
the *front* while the response is preserved. Old history is expendable; the thing being
learned is not.

## Run it

CUDA is strongly recommended. 240 steps of GPT-2 forward and backward passes on CPU is a very
long wait.

```cmd
curl -s http://127.0.0.1:8000/health
```

### Train

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"chat-sft-lora\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-chat-lora\",\"max_steps\":240,\"eval_every\":10,\"batch_size\":1,\"block_size\":384,\"learning_rate\":0.0003,\"sample_prompt\":\"who are you?\",\"load_when_complete\":true}"
```

### Test it in a real session

Create a conversation using the chat transcript format:

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Chat LoRA smoke\",\"model_id\":\"gpt2-chat-lora\",\"system_prompt\":\"You are Chatoken, a concise assistant for a learning console.\",\"max_history_messages\":8,\"context_token_budget\":512,\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

Send a fact, then ask for it back, using the returned `conversation_id`:

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/<CONVERSATION_ID>/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"My name is Rojar. Please remember it.\",\"model_id\":\"gpt2-chat-lora\",\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"

curl -s -X POST http://127.0.0.1:8000/conversations/<CONVERSATION_ID>/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"What is my name?\",\"model_id\":\"gpt2-chat-lora\",\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 12 · Chat SFT** on the ladder.

## What to observe

1. **It stops writing both sides of the conversation.** Compare against base GPT-2 in the
   same session format. This is the effect of loss masking.
2. **It answers from context.** "What is my name?" can be answered because the fact is in the
   rendered transcript — not because the model stored it anywhere.
3. **240 steps is 12× Stage 10, for a smaller behavior gain.** Turn-taking is harder to learn
   than answer shape.
4. **It still fails plenty of open questions.** A few hundred transcripts against a 124M base
   is a demonstration, not a product. Say so out loud; it is the honest reading.
5. **`training_objective: chat-lora` and `prompt_style: chat`** are recorded, so Stage 14 will
   not compare this against an instruction run.

## Exit check

You may continue when all of these are true:

- [ ] You can explain what `-100` does in the target tensor and why it matters.
- [ ] You can explain why prompt tokens are truncated from the front, not the back.
- [ ] You have held a two-turn session where the second answer depends on the first turn.
- [ ] You can state honestly what this checkpoint can and cannot do.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Chat dataset has no assistant responses to train on` | Transcript entries lack assistant turns | Check `data/chat/chat-sft-mini.json` structure |
| Training runs for hours | CPU | Use CUDA; see the GPU runtime reference |
| Replies ignore session history | `context_format` is `instruction-request`, not `chat-transcript` | Match the format the model was trained on |
| Model answers as the user | Loss masking not in effect, or the base model was used | Confirm `model_id` is `gpt2-chat-lora` |
| Session lost after restart | Conversations are in memory | Expected; see Stage 15 |

## Code map

| What | Where |
| --- | --- |
| Pair extraction, `-100` masking, front truncation | [`training.py`](../../packages/llm_core/llm_core/training.py) → `ChatTranscriptDataset` |
| Transcript rendering | [`generation.py`](../../packages/llm_core/llm_core/generation.py) → `format_chat_transcript` |
| Dataset spec | [`dataset_registry.py`](../../apps/api/services/dataset_registry.py) → `chat-sft-lora` |
| Training data | `data/chat/chat-sft-mini.json` |

## Next stage

[**Stage 13 · Your own dataset**](13-your-own-dataset.md) — every dataset so far was handed to
you. Now you write one.
