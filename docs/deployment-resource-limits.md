# Deployment and Resource Limits

[English](deployment-resource-limits.md) | [繁體中文](deployment-resource-limits.zh-TW.md)

This stage teaches how to move the learning app from "it runs on my machine" toward a deployable shape, while keeping resource limits visible.

The goal is not production hardening yet. The goal is to understand the boundaries:

```text
API process -> model memory -> context window -> concurrency -> training jobs
Web process -> API URL -> browser-safe config
External provider -> server-side secrets -> network/rate/cost limits
```

## Web UI

Open the `Deploy` tab.

Use it to inspect:

- current runtime device from `/health`
- server-side limits such as `chat_max_new_tokens` and `training_max_steps`
- model parameter count and context length
- rough inference memory by precision
- rough training memory when AdamW state and activations are included
- warnings for context overflow, `block_size > context_length`, and local generation serialization

The estimator is intentionally educational. It is not a profiler.

## API

Start the API from Windows Command Prompt with `.venv` activated:

```cmd
.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

Read the deployment profile:

```cmd
curl -s http://127.0.0.1:8000/deployment/profile
```

Estimate a small local inference shape:

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":1,\"precision\":\"fp32\",\"include_training\":false,\"batch_size\":4,\"block_size\":32}"
```

Estimate training as well:

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":2,\"precision\":\"fp32\",\"include_training\":true,\"batch_size\":4,\"block_size\":32}"
```

## What the Estimate Means

The estimate separates several concepts:

- `parameter_bytes`: model weights at the selected precision.
- `kv_cache_like_bytes`: what production serving often stores for cached keys and values.
- `local_context_work_bytes`: rough working memory for this teaching implementation.
- `attention_scratch_bytes`: attention score memory grows with context squared.
- `adamw_training_state_bytes`: AdamW optimizer state for training.
- `activation_estimate_bytes`: rough training activation memory.

This project's local generation loop recomputes the visible context each token. The KV cache value is shown because production inference servers usually use caching, and it is an important deployment concept.

## Deployment Shapes

### Local Development

Use this for learning:

```cmd
.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

In a second Command Prompt:

```cmd
cd apps\web
npm install
npm run dev
```

### Split API and Web

Build the Web UI:

```cmd
cd apps\web
npm install
npm run build
npm run start -- --port 3000
```

Set `NEXT_PUBLIC_API_BASE_URL` only to a public API URL. Do not put provider API keys in the Web process.

### GPU API Worker

Use CUDA for GPT-2 fine-tuning or larger checkpoints. The Web UI can remain on a small CPU host, but the API worker should run where the model lives.

## Resource Rules to Teach

1. `prompt_tokens + max_new_tokens` must fit inside the useful context window.
2. Larger `context_length` increases attention cost sharply.
3. More concurrent requests multiply context working memory.
4. Training needs more memory than inference because gradients and optimizer state are added.
5. External providers reduce local model memory pressure but add network latency, cost, and rate limits.
6. The current teaching backend runs one training/pretrained job worker to keep behavior observable.

The next production-oriented step would be queue persistence, process supervision, auth, logging, and real metrics. Those are intentionally outside this minimal learning deployment stage.
