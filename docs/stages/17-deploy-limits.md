# Stage 17 · Deploy & limits

[English](17-deploy-limits.md) | [繁體中文](17-deploy-limits.zh-TW.md)

**Part 5 · Ship** — Stage 17 of 17 · [Course index](../README.md)

## Focus

Cost is context length × concurrency.

## Prerequisites

- **Stage 16 · Streaming & cancel** — the system works for one person at a desk. This stage
  asks what happens when that stops being true.

## Concept

Everything so far assumed a single user on one machine. Deployment is mostly about what
breaks when that assumption goes away — and the answer is memory, in four distinct pools:

| Pool | Grows with | Notes |
| --- | --- | --- |
| `parameter_bytes` | model size × precision | Fixed per loaded model. fp16 halves it. |
| `kv_cache_like_bytes` | context × concurrency | What production servers cache per request |
| `attention_scratch_bytes` | context **squared** | The one that surprises people |
| `adamw_training_state_bytes` | trainable parameters × 2 | Only during training |

Weights are paid once. Everything else is paid **per concurrent request**, which is why a
model that runs comfortably alone can fail with ten users on the same box.

Attention scratch deserves the emphasis. Scores are computed for every query against every
key, so the cost grows with the square of context length. Doubling the window roughly
quadruples that pool. "Just increase the context length" is never free.

One honest note about this implementation: the local generation loop **recomputes the visible
context on every token** rather than caching keys and values. The estimator still reports
`kv_cache_like_bytes` because caching is what real inference servers do, and knowing the shape
of that cost matters more than matching this teaching loop exactly.

The server also publishes its own guardrails via `GET /deployment/profile`:

| Limit | Value |
| --- | --- |
| `chat_max_new_tokens` | 200 |
| `external_chat_max_new_tokens` | 2,000 |
| `training_max_steps` | 2,000 |

And it runs **one** training/pretrained worker at a time — deliberately, so behavior stays
observable while learning.

Three deployment shapes follow from all this:

**Local development.** API and web on one machine, both on 127.0.0.1. Everything so far.

**Split API and web.** Build the web app and point `NEXT_PUBLIC_API_BASE_URL` at a public API
URL. Anything prefixed `NEXT_PUBLIC_` is shipped to the browser — provider API keys must never
live in the web process. They belong on the API server, which is exactly how the external
provider track is wired.

**GPU API worker.** The web app can sit on a small CPU host; the API must run where the model
does. Model weights do not travel to the frontend.

## Run it

### Read the runtime profile

```cmd
curl -s http://127.0.0.1:8000/deployment/profile
```

### Estimate a single small request

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":1,\"precision\":\"fp32\",\"include_training\":false,\"batch_size\":4,\"block_size\":32}"
```

### Change one dimension at a time

Concurrency ×8:

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate -H "Content-Type: application/json" -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":8,\"precision\":\"fp32\",\"include_training\":false,\"batch_size\":4,\"block_size\":32}"
```

Context ×2 — watch the scratch pool:

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate -H "Content-Type: application/json" -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":64,\"max_new_tokens\":128,\"concurrent_requests\":1,\"precision\":\"fp32\",\"include_training\":false,\"batch_size\":4,\"block_size\":32}"
```

Add training:

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate -H "Content-Type: application/json" -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":2,\"precision\":\"fp32\",\"include_training\":true,\"batch_size\":4,\"block_size\":32}"
```

### Estimate GPT-2 instead

Repeat with `"model_id":"gpt2-124M"` and compare every pool.

### Build the web app for a split deployment

```cmd
cd apps\web
npm install
npm run build
npm run start -- --port 3000
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 17 · Deploy & limits** on the ladder.

## What to observe

1. **Concurrency multiplies everything except weights.** The parameter pool is flat; the rest
   scales linearly with request count.
2. **Doubling context more than doubles the total.** Find `attention_scratch_bytes` and confirm
   the quadratic growth yourself.
3. **Training costs far more than inference.** Gradients plus two AdamW states per parameter,
   on top of activations.
4. **fp16 halves the parameter pool and nothing else.** Precision is not a universal discount.
5. **Warnings fire on real mistakes** — `prompt_tokens + max_new_tokens` past the context
   window, or `block_size > context_length`, the same constraint from Stage 05.
6. **The estimator is a teaching tool, not a profiler.** It gives you the shape of the cost and
   which dimension dominates. Real capacity planning needs measurement.

## Exit check

The course is complete when all of these are true:

- [ ] You can name which memory pool grows with the square of context length.
- [ ] You can explain why weights are paid once but context is paid per request.
- [ ] You know why provider API keys must never reach the web process.
- [ ] You can describe the three deployment shapes and when each applies.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Estimates look impossibly large | Concurrency and context multiplied together | That is the lesson; lower one and re-estimate |
| Web app cannot reach the API | `NEXT_PUBLIC_API_BASE_URL` unset or wrong | Set it to the public API URL before `npm run build` |
| CUDA out of memory in production but not locally | Concurrency, not model size | Cap concurrent requests, or cap context |
| `block_size > context_length` warning | Training window wider than the model's window | Lower `block_size`; see Stage 05 |

## Code map

| What | Where |
| --- | --- |
| Profile, limits, and every estimate pool | [`deployment_service.py`](../../apps/api/services/deployment_service.py) |
| `GET /deployment/profile`, `POST /deployment/estimate` | [`deployment.py`](../../apps/api/routers/deployment.py) |
| Web API base URL | `apps/web/.env.example` → `NEXT_PUBLIC_API_BASE_URL` |
| Device selection | `torch.cuda.is_available()` in the service layer |

## Where to go next

You have built the whole path: tokens, a model, training, checkpoints, pretrained weights,
prompting, instruction tuning, LoRA, chat tuning, your own data, evaluation, sessions,
streaming, and deployment shape.

Two optional directions:

- [**External providers**](../tracks/external-models.md) — compare what you built against a
  hosted model.
- [**Reference**](../README.md#reference) — the glossary, API reference, and architecture map.
