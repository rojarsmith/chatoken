# External Model Integration

[English](external-model-integration.md) | [繁體中文](external-model-integration.zh-TW.md)

This stage connects the learning backend to provider-backed models without replacing the local learning path.

The goal is comparison:

```text
same message -> local model -> local reply
same message -> external provider -> external reply
```

The Web UI uses the `External` tab. The API keeps provider credentials on the server side, so browser code never receives an API key.

## Providers

The backend exposes real provider slots only. There is no mock provider in this
prototype because assistant replies should come from live model computation or a
real provider call.

| Provider | Model id | Purpose |
| --- | --- | --- |
| `openai-compatible` | `openai-compatible` | Calls a `/chat/completions` compatible endpoint from the API server. |
| `ollama` | `ollama-local` | Calls a local Ollama `/api/chat` endpoint from the API server. |

Check provider state:

```cmd
curl -s http://127.0.0.1:8000/external/models
```

## Configure an OpenAI-Compatible Endpoint

Set environment variables in Windows Command Prompt before starting the API:

```cmd
set LLM_ABC_EXTERNAL_OPENAI_API_KEY=your_api_key
set LLM_ABC_EXTERNAL_OPENAI_MODEL=your_model_name
set LLM_ABC_EXTERNAL_OPENAI_BASE_URL=https://api.openai.com/v1

.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

Then call:

```cmd
curl -s -X POST http://127.0.0.1:8000/external/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"provider\":\"openai-compatible\",\"model_id\":\"openai-compatible\",\"message\":\"Explain what a checkpoint is.\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"
```

The backend sends:

- `messages`
- `model`
- `max_tokens`
- `temperature`

`top_k` is shown in preview when selected, but it is not sent to the OpenAI-compatible `/chat/completions` request.

## Configure Ollama

Start Ollama separately, make sure the model exists locally, then start the API with:

```cmd
set LLM_ABC_EXTERNAL_OLLAMA_ENABLED=true
set LLM_ABC_EXTERNAL_OLLAMA_MODEL=your_local_ollama_model
set LLM_ABC_EXTERNAL_OLLAMA_BASE_URL=http://127.0.0.1:11434

.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

Then call:

```cmd
curl -s -X POST http://127.0.0.1:8000/external/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"provider\":\"ollama\",\"model_id\":\"ollama-local\",\"message\":\"Explain what a checkpoint is.\",\"max_new_tokens\":128,\"inference_mode\":\"focused\"}"
```

## Web UI Learning Checks

1. Open `External`.
2. Configure OpenAI-compatible or Ollama environment variables and restart the API.
3. Select the configured provider-backed model.
4. Choose a local model, such as `random-tiny-byte` or a loaded checkpoint.
5. Click `Preview` and inspect the rendered prompt plus provider `messages` payload.
6. Click `Compare` and confirm the local side and external side are clearly separated.

This stage teaches an important boundary: external models are useful baselines, but they do not explain how the local GPTModel, tokenizer, training loop, checkpoints, or fine-tuning work. They are comparison targets, not replacements for the from-scratch path.
