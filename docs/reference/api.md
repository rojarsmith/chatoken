# Reference · API

[English](api.md) | [繁體中文](api.zh-TW.md)

[Course index](../README.md)

Every endpoint, grouped by the stage that introduces it. Base URL for local development is
`http://127.0.0.1:8000`. Interactive docs are at `/docs` while the API is running.

## Runtime

| Method | Path | Stage | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Setup | Device, CUDA availability, runtime info |
| `GET` | `/models` | 02 | Locally loaded models |
| `GET` | `/runtime/device` | — | Current device, preference, and the options available |
| `POST` | `/runtime/device` | — | Switch between `auto`, `cuda`, and `cpu` without restarting |

Switching the device also moves already-loaded models onto it. Selecting `cuda`
where no CUDA device exists is rejected with `400` rather than silently falling
back — a preference that did not take should say so.

## Chat and generation

| Method | Path | Stage | Purpose |
| --- | --- | --- | --- |
| `POST` | `/chat` | 03 | Synchronous generation |
| `POST` | `/chat/prompt-preview` | 01, 09 | Render the prompt and count tokens without generating |
| `POST` | `/chat/stream` | 16 | Newline-delimited JSON token events |
| `POST` | `/chat/jobs` | 16 | Asynchronous generation job |
| `GET` | `/chat/jobs/{job_id}` | 16 | Job status and result |
| `POST` | `/chat/jobs/{job_id}/cancel` | 16 | Request cancellation |

Key `ChatRequest` fields: `message`, `model_id`, `max_new_tokens` (1–200), `temperature`
(0–2), `top_k` (1–200), `prompt_style` (`model-default` \| `raw` \| `chat` \| `instruction` \|
`custom`), `prompt_template`, `inference_mode` (`manual` \| `greedy` \| `focused` \|
`creative`).

## Training

| Method | Path | Stage | Purpose |
| --- | --- | --- | --- |
| `GET` | `/training/datasets` | 06 | Dataset ladder with recommended settings |
| `POST` | `/training/datasets/{id}/prepare` | 06, 10 | Download a dataset on demand |
| `POST` | `/training/jobs` | 04 | Start a training job |
| `GET` | `/training/jobs/{job_id}` | 04 | Status, progress events, summary |
| `POST` | `/training/jobs/{job_id}/cancel` | 16 | Cooperative cancellation |

Key `TrainingRequest` fields: `dataset_id`, `base_model_id`, `output_model_id`, `max_steps`
(1–2000), `batch_size` (1–64), `block_size` (2–1024), `learning_rate`, `eval_every`,
`sample_prompt`, `load_when_complete`.

## Datasets you build

| Method | Path | Stage | Purpose |
| --- | --- | --- | --- |
| `GET` | `/training/dataset-builder` | 13 | Examples with train/eval counts |
| `POST` | `/training/dataset-builder/seed` | 13 | Create starter examples |
| `POST` | `/training/dataset-builder/examples` | 13 | Add an example |
| `PUT` | `/training/dataset-builder/examples/{id}` | 13 | Update an example |
| `DELETE` | `/training/dataset-builder/examples/{id}` | 13 | Delete an example |

## Checkpoints and experiments

| Method | Path | Stage | Purpose |
| --- | --- | --- | --- |
| `GET` | `/checkpoints` | 07 | Saved model versions with lineage |
| `POST` | `/models/load` | 07 | Load a checkpoint as a chat model |
| `GET` | `/training/experiments` | 14 | Recorded training runs |
| `GET` | `/training/experiments/compare` | 14 | Compare two runs (`left_id`, `right_id`) |

## Pretrained GPT-2

| Method | Path | Stage | Purpose |
| --- | --- | --- | --- |
| `GET` | `/pretrained/models` | 08 | Available GPT-2 sizes and download state |
| `POST` | `/pretrained/jobs` | 08 | Download and load (`model_size`: `124M`…`1558M`) |
| `GET` | `/pretrained/jobs/{job_id}` | 08 | Download and load progress |
| `POST` | `/pretrained/jobs/{job_id}/cancel` | 16 | Cancel a download or load |

## Conversations

| Method | Path | Stage | Purpose |
| --- | --- | --- | --- |
| `GET` | `/conversations` | 15 | List in-memory sessions |
| `POST` | `/conversations` | 15 | Create a session |
| `GET` | `/conversations/{id}` | 15 | Session with full message history |
| `DELETE` | `/conversations/{id}` | 15 | Delete a session |
| `POST` | `/conversations/{id}/context-preview` | 15 | Rendered context, token math, omissions, warnings |
| `POST` | `/conversations/{id}/messages` | 15 | Send a turn and generate a reply |

Session fields: `system_prompt`, `context_format` (`chat-transcript` \|
`instruction-request`), `max_history_messages`, `context_token_budget`, plus the usual
generation settings.

## Deployment

| Method | Path | Stage | Purpose |
| --- | --- | --- | --- |
| `GET` | `/deployment/profile` | 17 | Runtime device and server limits |
| `POST` | `/deployment/estimate` | 17 | Memory estimate by precision and concurrency |

Server limits: `chat_max_new_tokens` 200, `external_chat_max_new_tokens` 2,000,
`training_max_steps` 2,000.

## External providers

| Method | Path | Track | Purpose |
| --- | --- | --- | --- |
| `GET` | `/external/models` | T1 | Configured provider slots |
| `POST` | `/external/prompt-preview` | T1 | The exact outgoing provider payload |
| `POST` | `/external/chat` | T1 | Call the provider server-side |

Credentials come from environment variables read by the API process:
`CHATOKEN_EXTERNAL_OPENAI_API_KEY`, `CHATOKEN_EXTERNAL_OPENAI_MODEL`,
`CHATOKEN_EXTERNAL_OPENAI_BASE_URL`, `CHATOKEN_EXTERNAL_OLLAMA_ENABLED`,
`CHATOKEN_EXTERNAL_OLLAMA_MODEL`, `CHATOKEN_EXTERNAL_OLLAMA_BASE_URL`. They never reach the
browser.

## Job lifecycle

Chat, training, and pretrained jobs share one state machine:

```
queued -> running -> succeeded
              |  \
              |   -> failed      (error is recorded)
              +-> cancelled      (cooperative; see Stage 16)
```

Cancelling a `queued` job takes effect immediately. Cancelling a `running` job takes effect at
the next safe checkpoint.
