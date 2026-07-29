# Track · External providers

[English](external-models.md) | [繁體中文](external-models.zh-TW.md)

**Optional track** — not on the ladder · [Course index](../README.md)

## Focus

Compare what you built against a hosted model — and keep the credentials off the browser.

## Why this is a track, not a stage

Every stage in the course adds a layer to the same model. This one does not: calling somebody
else's API teaches you nothing about tokenizers, training loops, checkpoints, or fine-tuning.

It is still worth doing once, for two reasons. It gives you a reference point for how far a
136k-parameter model or a lightly tuned GPT-2 actually is from a production assistant. And it
demonstrates the one security boundary in this project that matters.

Take it any time after **Stage 09 · Prompt format**, when you have a local model worth
comparing and understand how prompts are rendered.

## Concept

The API exposes two real provider slots. There is no mock provider — a fake reply would defeat
the purpose of a comparison.

| Provider | Model id | Calls |
| --- | --- | --- |
| `openai-compatible` | `openai-compatible` | Any `/chat/completions`-compatible endpoint |
| `ollama` | `ollama-local` | A local Ollama `/api/chat` endpoint |

**The credential boundary is the lesson.** Provider keys are read from environment variables
by the API process and never leave it. The browser calls `POST /external/chat` on your own
API, which then calls the provider server-side. No key is ever sent to the frontend, and no
`NEXT_PUBLIC_` variable should ever hold one — anything with that prefix is compiled into the
JavaScript bundle and is effectively public.

`POST /external/prompt-preview` shows exactly what would be sent to the provider before
anything is sent. The request carries `messages`, `model`, `max_tokens`, and `temperature`.
Note that `top_k` appears in the preview but is **not** sent to an OpenAI-compatible
`/chat/completions` request — a small, concrete lesson in how provider APIs differ from the
local generation loop you wrote.

## Run it

### Check which providers are configured

```cmd
curl -s http://127.0.0.1:8000/external/models
```

### Configure an OpenAI-compatible endpoint

Set these before starting the API, in the same Command Prompt:

```cmd
set CHATOKEN_EXTERNAL_OPENAI_API_KEY=your_api_key
set CHATOKEN_EXTERNAL_OPENAI_MODEL=your_model_name
set CHATOKEN_EXTERNAL_OPENAI_BASE_URL=https://api.openai.com/v1

.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

### Or configure Ollama

Start Ollama separately and confirm the model is pulled locally, then:

```cmd
set CHATOKEN_EXTERNAL_OLLAMA_ENABLED=true
set CHATOKEN_EXTERNAL_OLLAMA_MODEL=your_local_ollama_model
set CHATOKEN_EXTERNAL_OLLAMA_BASE_URL=http://127.0.0.1:11434

.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

### Preview the outgoing request

```cmd
curl -s -X POST http://127.0.0.1:8000/external/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"provider\":\"openai-compatible\",\"model_id\":\"openai-compatible\",\"message\":\"Explain what a checkpoint is.\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"
```

### Send the same message both ways

```cmd
curl -s -X POST http://127.0.0.1:8000/external/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"provider\":\"openai-compatible\",\"model_id\":\"openai-compatible\",\"message\":\"Explain what a checkpoint is.\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"

curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Explain what a checkpoint is.\",\"model_id\":\"gpt2-instruct-lora\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"
```

### In the console

Open `http://127.0.0.1:3000` and pick **External providers** from the Workbench drawer, or go to `/track/external-models`.

## What to observe

1. **The gap is large, and worth seeing plainly.** A hosted model answers; your checkpoint
   approximates the shape of an answer. Neither fact should surprise you by now.
2. **The preview shows the full outgoing payload.** You can read exactly what leaves your
   machine before it leaves.
3. **No credential appears in any browser-visible response.** Check the network tab if you
   like — that is the point of the boundary.
4. **`top_k` is previewed but not sent.** Provider APIs are not the same surface as your local
   `generate` function.
5. **Latency and failure modes are different.** Network errors, rate limits, and per-token
   billing are costs the local path does not have.

## Exit check

- [ ] You have compared one local checkpoint against a real provider on the same message.
- [ ] You can explain why the API calls the provider instead of the browser doing it.
- [ ] You can name one parameter that does not survive the trip to a provider.
- [ ] You can state what this track does *not* teach you about building models.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Provider shows as not configured | Environment variables set after the API started | Set them first, then start uvicorn |
| 401 from the provider | Wrong or expired key | Rotate the key; never commit it |
| Ollama connection refused | Ollama not running, or wrong base URL | Start Ollama; check port 11434 |
| Model not found | The model name is not pulled locally / not available on the account | `ollama pull <model>`, or check the provider's model list |

## Code map

| What | Where |
| --- | --- |
| Provider registry, env config, request building | [`external_model_service.py`](../../apps/api/services/external_model_service.py) |
| `GET /external/models`, `POST /external/prompt-preview`, `POST /external/chat` | [`external.py`](../../apps/api/routers/external.py) |
| Browser-visible config | `apps/web/.env.example` — `NEXT_PUBLIC_` only, never secrets |

## Back to the course

[Course index](../README.md)
