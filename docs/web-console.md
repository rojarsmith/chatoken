# Minimal Web UI Learning Console

[English](web-console.md) | [繁體中文](web-console.zh-TW.md)

This document explains the Web UI learning console for LLM ABC.

The console connects a small Next.js app to the FastAPI backend and keeps three learning paths separate:

```text
tiny model -> dataset ladder -> checkpoints
the-verdict -> raw text continuation training
GPT-2 -> instruction prompt -> optional instruction SFT
```

## What Was Added

- `apps/web`: a minimal Next.js learning console.
- Chat view: send a prompt to a selected model.
- From Scratch view: train the tiny model on small chat-shaped datasets.
- Raw Text view: train on The Verdict as larger continuation text.
- GPT-2 view: download and load GPT-2 pretrained weights.
- Instruction view: fine-tune GPT-2 on instruction/response data.
- Experiments view: compare saved training runs across objective, loss, and before/after output.
- Checkpoints view: list saved full checkpoints and load one as a chat model.
- API CORS support for local browser development.

## Run the API

Use Windows Command Prompt with `.venv` activated:

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

## Run the Web UI

Open a second Windows Command Prompt:

```cmd
cd apps\web
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:3000
```

## Learning Flow

1. Open Chat and send `Every effort moves you` to `random-tiny-byte`.
2. Open From Scratch and run `every-effort`, then compare before/after.
3. Open Raw Text; the UI should select `the-verdict` and suggest `random-tiny-byte` plus `trained-verdict-byte`.
4. Run the The Verdict job to observe raw text continuation on a larger dataset.
5. Open GPT-2 and load `GPT-2 small`.
6. Return to Chat and ask an instruction-style request such as `Explain what a model checkpoint is in one sentence.`
7. Open Instruction; the UI should select `instruction-following` and suggest `gpt2-124M` plus `gpt2-instruct-finetuned`.
8. Open Experiments to compare raw pretrained GPT-2 and instruction-tuned GPT-2.

## Why This Separation Matters

The Verdict teaches the model to continue raw text. It does not teach GPT-2 to answer user requests.

GPT-2 question/request behavior uses the Chapter 7 instruction prompt format. Better instruction following comes from the `instruction-following` SFT dataset, not from The Verdict.

The dataset-size stage is available in [Dataset ladder and training experiments](dataset-ladder-experiments.md).
GPT-2 loading and instruction prompts are explained in [GPT-2 Pretrained and Instruction Prompts](gpt2-pretrained.md).
