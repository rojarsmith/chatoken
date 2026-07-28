# Chatoken

[English](README.md) | [繁體中文](README.zh-TW.md)

Chatoken is an educational project for building a minimal ChatGPT-like system from scratch.
It starts with a tiny PyTorch GPT model, exposes it through an AI API backend, and drives a
Next.js web console — the whole path from random weights, through training, fine-tuning, and
serving.

The goal is not a powerful assistant. The goal is to walk the path in order, one idea at a
time, and understand every step.

## → [Start the course](docs/README.md)

Seventeen stages in five parts. Each stage teaches exactly one new idea and builds on the one
before it:

| Part | Stages | What you end up with |
| --- | --- | --- |
| 1 · Generate | 01–03 | A model that produces tokens |
| 2 · Train | 04–07 | A model that learned from your data, saved as a checkpoint |
| 3 · Reuse | 08–09 | Pretrained GPT-2 running in the same code |
| 4 · Align | 10–14 | Instruction tuning, LoRA, chat tuning, your own dataset, evaluation |
| 5 · Ship | 15–17 | Sessions, streaming, and a deployment cost model |

Every document is available in English and 繁體中文.

## Setup

All Python commands run inside the project-local `.venv`. Use Windows Command Prompt
(`cmd.exe`) with Windows CPython **3.11, 3.12, or 3.13** — not 3.14, because PyTorch wheels
are unavailable for it in this setup.

```cmd
where python
python --version

python -m venv .venv
.venv\Scripts\activate.bat

python -m pip install --upgrade pip
python -m pip install -e . -r apps\api\requirements.txt
```

Full details, including how to recreate a venv built with the wrong Python version, are in
[Setup](docs/reference/setup.md).

## Run it

Start the API:

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

Start the web console in a second Command Prompt:

```cmd
cd apps\web
npm install
npm run dev
```

Then open `http://127.0.0.1:3000`.

## Confirm it works

This runs the model end to end without any server:

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24
```

Output that looks like escaped bytes is **correct** — the model is untrained.
[Stage 01](docs/stages/01-tokens.md) explains why, and the course goes on from there.

## Project layout

| Path | Contents |
| --- | --- |
| `packages/llm_core` | The model: tokenizer, GPT architecture, generation, training, checkpoints, LoRA |
| `apps/api` | FastAPI backend — endpoints, jobs, services |
| `apps/web` | Next.js learning console |
| `scripts` | No-server smoke tests for generation and training |
| `data` | Datasets, from a 4-line tiny file up to raw prose and instruction data |
| `models` | Checkpoints, downloaded GPT-2 weights, experiment log (all git-ignored) |
| `docs` | The course, the optional track, and the reference set |

[Architecture](docs/reference/architecture.md) explains how the three layers fit together.

## Documentation

- [Course index](docs/README.md) — the ordered path, start here
- [Setup](docs/reference/setup.md) · [GPU runtime](docs/reference/gpu-runtime.md) ·
  [API](docs/reference/api.md) · [Architecture](docs/reference/architecture.md) ·
  [Glossary](docs/reference/glossary.md) · [Troubleshooting](docs/reference/troubleshooting.md)
- [External providers track](docs/tracks/external-models.md) — optional
- [Restructure plan](docs/restructure-plan.md) — why the project is organized this way
