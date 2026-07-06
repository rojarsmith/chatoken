# Minimal Web UI Learning Console

[English](web-console.md) | [繁體中文](web-console.zh-TW.md)

This document explains the Web UI learning console for LLM ABC.

The console connects a small Next.js app to the FastAPI backend and keeps three learning paths separate:

```text
tiny model -> dataset ladder -> checkpoints
the-verdict -> raw text continuation training
GPT-2 -> instruction prompt -> optional instruction SFT
GPT-2 -> frozen base -> LoRA adapters -> merged checkpoint
custom instruction examples -> train/eval split -> custom SFT
checkpoint versions -> experiment comparison -> model selection
streamed tokens -> cancel running jobs -> responsive UI
prompt template -> rendered prompt -> inference mode comparison
```

## What Was Added

- `apps/web`: a minimal Next.js learning console.
- GPT Model view: inspect the local GPTModel build order from token ids to logits.
- Training Config view: learn how TrainingConfig knobs change the training loop.
- Chat view: stream token events from a selected model and cancel the active stream.
- Prompt Lab view: preview rendered prompts, compare prompt templates, and switch inference modes.
- From Scratch view: train the tiny model on small chat-shaped datasets.
- Raw Text view: train on The Verdict as larger continuation text.
- GPT-2 view: download and load GPT-2 pretrained weights.
- Instruction view: prepare instruction data, load GPT-2, then fine-tune on instruction/response examples.
- LoRA view: freeze GPT-2, train low-rank adapters, then save a merged checkpoint.
- Dataset Builder view: create local instruction examples, split them into train/eval, then train custom SFT.
- Experiments view: compare saved training runs across version, objective, loss delta, and before/after output.
- Checkpoints view: inspect model versions, lineage, training config, and load one as a chat model.
- Cancel controls for streaming chat, training jobs, and GPT-2 load/download jobs.
- API CORS support for local browser development.

## Run the API

Use Windows Command Prompt with `.venv` activated:

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

Check the current runtime device:

```cmd
curl -s http://127.0.0.1:8000/health
```

The Web UI shows the same runtime in the top bar. CPU is fine for the tiny from-scratch lessons. GPT-2 instruction SFT should use CUDA for reasonable training time; CPU should be treated as a short smoke test only. Setup steps are in [GPU Runtime Setup for PyTorch](gpu-runtime.md).

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

1. Open GPT Model and inspect the local implementation path from `GPTModel` to logits.
2. Open Training Config and change `max_steps`, `batch_size`, `block_size`, `learning_rate`, and `eval_every`.
3. Open Chat and send `Every effort moves you` to `random-tiny-byte`.
4. Open Prompt Lab, preview the same message with `raw`, `chat`, `instruction`, and `custom`, then compare `greedy`, `focused`, and `creative`.
5. Open From Scratch and run `every-effort`, then compare before/after.
6. Open Raw Text; the UI should select `the-verdict` and suggest `random-tiny-byte` plus `trained-verdict-byte`.
7. Run the The Verdict job to observe raw text continuation on a larger dataset.
8. Open GPT-2 and load `GPT-2 small`.
9. Return to Chat and ask an instruction-style request such as `Explain what a model checkpoint is in one sentence.`
10. Open Instruction; the UI should select `instruction-following` and show the three-step loop: instruction data, GPT-2 base, instruction SFT.
11. Click `Download dataset` if the instruction data is missing. The panel should then show one dataset example and the formatted Chapter 7 model input.
12. Load `GPT-2 small`, run instruction SFT, then compare `Before (raw GPT-2)` with `After (instruction SFT)`.
13. Open LoRA; the UI should select `instruction-lora` and show LoRA adapter training.
14. Run LoRA and compare trainable parameter percentage against full instruction SFT.
15. Open Dataset Builder; inspect seeded examples, add a `train` example, and add an `eval` example.
16. Run custom SFT with `instruction-builder` and compare `Before (GPT-2 base)` with `After (custom SFT)`.
17. Open Experiments to compare raw pretrained GPT-2, full SFT, LoRA, and custom SFT.
18. Read the comparison summary before reading generated samples.
19. Open Checkpoints to inspect model version lineage and load a specific version.
20. Return to Chat, send a streaming request, and cancel it before `max_new_tokens` is reached.

## Why This Separation Matters

The Verdict teaches the model to continue raw text. It does not teach GPT-2 to answer user requests.

GPT-2 question/request behavior uses the Chapter 7 instruction prompt format. Better instruction following comes from the `instruction-following` SFT dataset, not from The Verdict.

The dataset-size stage is available in [Dataset ladder and training experiments](dataset-ladder-experiments.md).
The foundation stage is explained in [Model Foundations](model-foundations.md).
GPT-2 loading and instruction prompts are explained in [GPT-2 Pretrained and Instruction Prompts](gpt2-pretrained.md).
LoRA is explained in [LoRA / Parameter-Efficient Fine-Tuning](lora-peft.md).
Dataset Builder is explained in [Training Data Management and Dataset Builder](dataset-builder.md).
Model versioning is explained in [Model Versions and Experiment Comparison](model-version-experiment-comparison.md).
Streaming and cancellation are explained in [Streaming Chat and Job Cancellation](streaming-chat-cancel.md).
Inference modes and prompt templates are explained in [Inference Modes and Prompt Template Playground](inference-prompt-playground.md).
GPU setup is explained in [GPU Runtime Setup for PyTorch](gpu-runtime.md).
