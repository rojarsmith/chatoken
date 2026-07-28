# Stage 16 · Streaming & cancel

[English](16-streaming-cancel.md) | [繁體中文](16-streaming-cancel.zh-TW.md)

**Part 5 · Ship** — Stage 16 of 17 · [Course index](../README.md)

## Focus

Tokens arrive one at a time, and users must be able to stop.

## Prerequisites

- **Stage 15 · Conversation memory** — you have a working multi-turn session that blocks until
  the whole answer is finished.

## Concept

Stage 03 established that generation is a loop producing one token per iteration. Every
endpoint so far has hidden that: the request blocks until the loop ends, then returns
everything. For an 80-token answer on CPU, that is a long silence.

**Streaming** exposes the loop that was always there. `POST /chat/stream` returns
newline-delimited JSON — one event per line, flushed as it happens:

```json
{"event":"start","model_id":"random-tiny-byte","prompt_tokens":31}
{"event":"token","delta":"A","reply":"A","tokens_generated":1}
{"event":"done","result":{"model_id":"random-tiny-byte","reply":"..."}}
```

Each `token` event carries both the `delta` (what is new) and the `reply` so far, so a client
can either append or replace. No new model capability is involved — the same loop, reported
as it runs.

**Cancellation** is cooperative, not forced. Three endpoints exist:

```
POST /chat/jobs/{job_id}/cancel
POST /training/jobs/{job_id}/cancel
POST /pretrained/jobs/{job_id}/cancel
```

Each sets `cancel_requested = true`. What happens next depends on the job's state:

| State when cancelled | Result |
| --- | --- |
| `queued` | Becomes `cancelled` immediately — it never started |
| `running` | Continues to the next safe checkpoint, then stops and records `cancelled` |

The API never kills a thread or the process. In the training loop, `_raise_if_cancelled` is
checked between steps, so a cancelled run stops between optimizer updates rather than in the
middle of one. That keeps model state, open files, and the dev server intact — the cost is
that cancellation is not instantaneous, and on a slow step you will wait for it.

This is the general shape of the trade: forced termination is fast and unsafe; cooperative
cancellation is safe and slightly late. Production systems overwhelmingly choose the latter.

## Run it

### Watch tokens arrive

`-N` disables curl's buffering, which is the whole point here:

```cmd
curl -N -s -X POST http://127.0.0.1:8000/chat/stream ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"message\":\"Every effort moves you\",\"max_new_tokens\":12,\"temperature\":0}"
```

Compare against the blocking endpoint — same result, different delivery:

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"message\":\"Every effort moves you\",\"max_new_tokens\":12,\"temperature\":0}"
```

### Cancel a queued job

Start a long training run, then cancel it immediately:

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"the-verdict\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"cancel-test\",\"max_steps\":2000,\"eval_every\":50,\"block_size\":64}"

curl -s -X POST "http://127.0.0.1:8000/training/jobs/<JOB_ID>/cancel"
curl -s "http://127.0.0.1:8000/training/jobs/<JOB_ID>"
```

### Cancel a running job

Start the same job, wait until `status` is `running`, then cancel and poll. Time how long it
takes to reach `cancelled`.

### In the console

> The stage ladder ships in Phase 2 of the restructure. Until then streaming lives in the
> legacy console tab **Chat**, and cancel buttons appear on the training and GPT-2 panels.

## What to observe

1. **The first `token` event arrives long before the answer is complete.** Perceived latency
   drops even though total time does not change at all.
2. **`start` carries `prompt_tokens` before any generation.** The client can show context cost
   immediately.
3. **A cancelled `queued` job flips instantly**; a cancelled `running` job takes until the next
   step boundary. Measure both — the difference is the lesson.
4. **`cancel_requested` is visible in the job payload** even while the status is still
   `running`. The flag and the state are separate.
5. **No checkpoint is written for a cancelled training job.** Cancellation stops before the
   save.
6. **Streaming does not change the output.** At `temperature 0`, streamed and blocking calls
   produce identical text.

## Exit check

You may continue when all of these are true:

- [ ] You can name the three event types on `/chat/stream` and what each carries.
- [ ] You can explain why cancellation is cooperative rather than forced.
- [ ] You have cancelled both a queued and a running job and observed the timing difference.
- [ ] You can state what streaming changes and what it does not.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| The stream arrives all at once | curl buffering | Add `-N` |
| Cancel returns 404 | Wrong job id, or the job already finished | Poll the job first |
| A running job takes seconds to cancel | The current step must finish | Expected — that is what "cooperative" means |
| A cancelled job shows `failed` | The worker raised before the cancel check | Read the `error` field |

## Code map

| What | Where |
| --- | --- |
| `POST /chat/stream` and NDJSON events | [`apps/api/main.py`](../../apps/api/main.py) → `stream_chat` |
| Token-by-token generation for streaming | [`chat_service.py`](../../apps/api/services/chat_service.py) |
| Cancel endpoints and flag handling | `_cancel_chat_job`, `_cancel_training_job`, `_cancel_pretrained_job` in `main.py` |
| The cancellation check inside training | [`training.py`](../../packages/llm_core/llm_core/training.py) → `_raise_if_cancelled` |

## Next stage

[**Stage 17 · Deploy & limits**](17-deploy-limits.md) — the last stage: what this costs when
more than one person uses it.
