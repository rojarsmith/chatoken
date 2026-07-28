# Reference · Architecture

[English](architecture.md) | [繁體中文](architecture.zh-TW.md)

[Course index](../README.md)

How the three pieces fit together, and which stage teaches which part.

## The three layers

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web        Next.js console — the learning ladder       │
│                  talks HTTP to the API, never imports torch  │
├─────────────────────────────────────────────────────────────┤
│  apps/api        FastAPI — endpoints, jobs, services         │
│                  owns credentials, device selection, state   │
├─────────────────────────────────────────────────────────────┤
│  packages/llm_core   The model itself — pure PyTorch         │
│                      no FastAPI, no HTTP, no project state   │
└─────────────────────────────────────────────────────────────┘
```

The direction of dependency is strict and one-way. `llm_core` knows nothing about the API;
the API knows nothing about the browser. You can use `llm_core` from a script with no server
running — which is exactly what `scripts/smoke_chat.py` and `scripts/smoke_train.py` do.

## packages/llm_core

The teaching core. Every file is small enough to read in one sitting.

| Module | Contents | Stage |
| --- | --- | --- |
| `tokenizer.py` | `ByteTokenizer`, `GPT2Tokenizer` | 01 |
| `configs.py` | `ModelConfig`, `MODEL_CONFIGS` | 02 |
| `model.py` | `MultiHeadAttention`, `GELU`, `FeedForward`, `LayerNorm`, `TransformerBlock`, `GPTModel` | 02 |
| `generation.py` | Prompt templates, `generate`, transcript formatting | 03, 09 |
| `training.py` | `TrainingConfig`, the datasets, `train_tiny_language_model` | 04–06, 10, 12 |
| `checkpoints.py` | Save, load, list, version metadata | 07 |
| `gpt2.py` | GPT-2 specs, download, Hugging Face weight mapping | 08 |
| `lora.py` | `LoRAConfig`, `LoRALinear`, apply and merge | 11 |

Three dataset classes live in `training.py`, one per objective:

| Class | Objective | Target shape |
| --- | --- | --- |
| `TokenDataset` | Raw text / chat text | Next token at every position |
| `InstructionDataset` | Instruction SFT | Next token over the rendered instruction block |
| `ChatTranscriptDataset` | Chat SFT | Next token, prompt positions masked to `-100` |

## apps/api

FastAPI. `main.py` only assembles the application; everything else has its own home.

| Module | Responsibility |
| --- | --- |
| `main.py` | App metadata, CORS, router registration — nothing else |
| `routers/` | Endpoints, grouped by course stage |
| `schemas/` | Pydantic request/response models, grouped by domain |
| `converters.py` | Pydantic models → the plain dataclasses services accept |
| `dependencies.py` | Process-wide singletons: services, executor, job registries |
| `jobs/registry.py` | One job lifecycle for chat, training, and pretrained work |

| Service | Responsibility |
| --- | --- |
| `chat_service.py` | Loaded model registry, generation, prompt preview, streaming |
| `training_service.py` | Training runs and the experiment log |
| `dataset_registry.py` | The dataset ladder as declarative data |
| `dataset_inspect.py` | Previews, split counts, example shapes |
| `experiment_compare.py` | Whether two runs may be compared at all |
| `pretrained_service.py` | GPT-2 download and registration |
| `conversation_service.py` | In-memory sessions, context rendering, budgets |
| `deployment_service.py` | Runtime profile and resource estimates |
| `external_model_service.py` | Provider configuration and server-side calls |

Three job types — chat, training, pretrained — share one lifecycle
(`queued → running → succeeded | failed | cancelled`) with cooperative cancellation.
`JobRegistry` implements it once; chat jobs opt out of the `progress` list because
they never reported one.

Endpoints carry `stage:<id>` OpenAPI tags, so `/docs` groups itself by the course.

All state is in process memory: loaded models, conversations, and job records vanish on
restart. Only checkpoints, downloads, datasets, and the experiment log are on disk.

## apps/web

A Next.js console that is a client of the API and nothing more. It holds no model code, no
credentials, and no training logic. `NEXT_PUBLIC_API_BASE_URL` is the only configuration it
needs — and, because anything with that prefix is compiled into the browser bundle, the only
kind of value that may ever go there.

## Data and artifacts on disk

| Path | Written by | In git |
| --- | --- | --- |
| `data/tiny|small|medium|chat/` | shipped with the repo | yes |
| `data/external/` | dataset prepare endpoints | no |
| `data/custom/` | the Dataset Builder | no |
| `models/downloaded/` | GPT-2 download jobs | no |
| `models/checkpoints/` | every training job | no |
| `models/experiments/` | the experiment log | no |

## Where the course touches the code

| Part | Layer it teaches |
| --- | --- |
| 1 · Generate | `llm_core` only — tokenizer, model, generation |
| 2 · Train | `llm_core` training and checkpoints, driven by the API |
| 3 · Reuse | `llm_core/gpt2.py` plus the pretrained service |
| 4 · Align | `llm_core` datasets and LoRA, plus the training service |
| 5 · Ship | The API and web layers — the model does not change |

Parts 1–4 build the model. Part 5 builds the system around it. That split is the reason the
dependency arrows point in only one direction.
