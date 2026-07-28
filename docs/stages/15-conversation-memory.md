# Stage 15 · Conversation memory

[English](15-conversation-memory.md) | [繁體中文](15-conversation-memory.zh-TW.md)

**Part 5 · Ship** — Stage 15 of 17 · [Course index](../README.md)

## Focus

The model is stateless. The application supplies the memory.

## Prerequisites

- **Stage 14 · Compare runs** — the modeling work is done. From here the subject is the system
  around the model.

## Concept

Nothing you have built remembers anything. `generate` takes a tensor of ids and returns a
longer one. Between two calls, the model retains nothing whatsoever.

Everything that feels like memory in a chat product is the application re-sending the history
on every turn:

```
turn 3 request
  = system prompt
  + turn 1 user + turn 1 assistant
  + turn 2 user + turn 2 assistant
  + turn 3 user
  -> rendered into one string -> tokenized -> generate
```

There are two separate limits on how much history survives, and confusing them causes most
"the model forgot" bugs:

**The application's budget** — `max_history_messages` (how many recent messages to render) and
`context_token_budget` (a token ceiling the renderer applies). These are your policy.

**The model's real window** — `context_length`, a hard architectural limit from the position
embedding table in Stage 02. For `random-tiny-byte` that is **64 tokens**. For GPT-2 it is
1,024.

The API can store a hundred messages. If the model's window is 64 tokens, it attends to
roughly the last sentence. `POST /conversations/{id}/context-preview` exists to make that
gap visible before you send: it reports the exact transcript, `prompt_tokens`, the budget, the
model's `context_length`, which messages were dropped by history limit, which were dropped by
token budget, and warnings when the transcript exceeds what the model can actually see.

Two rendering formats are available:

| Format | What it sends |
| --- | --- |
| `chat-transcript` | `System:` / `User:` / `Assistant:` lines directly |
| `instruction-request` | The whole session wrapped as one instruction asking for a reply to the latest message |

Match the format to how the model was trained: `chat-transcript` for `gpt2-chat-lora` from
Stage 12, `instruction-request` for the instruction-tuned checkpoints from Stages 10, 11, 13.

Sessions live in process memory and are cleared when the API restarts. That is deliberate for
a teaching prototype; a production version would add persistence, accounts, auth, rate limits,
and possibly summary-based long-term memory.

## Run it

### Create a session

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Memory smoke test\",\"model_id\":\"random-tiny-byte\",\"system_prompt\":\"You are a concise assistant.\",\"max_history_messages\":8,\"context_token_budget\":256,\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

### Send a fact

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/<CONVERSATION_ID>/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"My name is Rojar. Please remember it.\",\"model_id\":\"random-tiny-byte\",\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"inference_mode\":\"greedy\"}"
```

### Preview before asking for it back

This is the important call in this stage:

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/<CONVERSATION_ID>/context-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"What is my name?\",\"model_id\":\"random-tiny-byte\",\"context_format\":\"chat-transcript\",\"max_new_tokens\":16,\"inference_mode\":\"greedy\"}"
```

### Repeat against a model with a real window

Run the same three calls with `"model_id":"gpt2-chat-lora"` and compare the previews.

### Manage sessions

```cmd
curl -s http://127.0.0.1:8000/conversations
curl -s http://127.0.0.1:8000/conversations/<CONVERSATION_ID>
curl -s -X DELETE http://127.0.0.1:8000/conversations/<CONVERSATION_ID>
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 15 · Conversation memory** on the ladder.

## What to observe

1. **The preview shows the entire prompt**, system line included. Nothing is hidden from you
   that is not hidden from the model.
2. **`random-tiny-byte` drops almost everything.** With `context_length=64`, the stored
   transcript far exceeds what the model can attend to, and the warning says so.
3. **Two different omission counts are reported** — history limit and token budget. They are
   separate policies and can fire independently.
4. **Raising `max_history_messages` does not raise `context_length`.** Application policy
   cannot exceed architecture. Try it and watch the warning persist.
5. **Each stored message records the model that produced it.** Switching models mid-session
   does not rewrite older turns — the badges show a mixed history.
6. **Restarting the API empties everything.** In-memory storage, stated up front.

## Exit check

You may continue when all of these are true:

- [ ] You can explain why the model appears to remember without storing anything.
- [ ] You can name the two application limits and the one architectural limit.
- [ ] You have previewed a context that was truncated, and can say which limit caused it.
- [ ] You can match a context format to the way a checkpoint was trained.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| The model "forgets" immediately | `context_length` is 64 on the tiny model | Use a GPT-2 checkpoint; this is architecture, not a bug |
| Replies ignore the system prompt | Base GPT-2 was never trained to honor one | Use `gpt2-chat-lora`; see Stage 12 |
| Sessions disappear | The API restarted | In-memory by design |
| Answers look off-topic or repetitive | Greedy decoding on a weak model | Expected in early stages; revisit Stage 03 and 09 |
| Format mismatch produces nonsense | `instruction-request` sent to a chat-trained model | Match format to training |

## Code map

| What | Where |
| --- | --- |
| Session storage, history/budget policy, preview | [`conversation_service.py`](../../apps/api/services/conversation_service.py) |
| Transcript rendering | [`generation.py`](../../packages/llm_core/llm_core/generation.py) → `format_chat_transcript` |
| Hard context limit | [`model.py`](../../packages/llm_core/llm_core/model.py) → `pos_emb` bound in `forward` |
| Conversation endpoints | [`apps/api/main.py`](../../apps/api/main.py) |

## Next stage

[**Stage 16 · Streaming & cancel**](16-streaming-cancel.md) — the answer is correct but it
arrives all at once, and nothing can stop it.
