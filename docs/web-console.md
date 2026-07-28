# Minimal Web UI Learning Console

[English](web-console.md) | [繁體中文](web-console.zh-TW.md)

This document explains the Web UI learning console for Chatoken.

The console connects a small Next.js app to the FastAPI backend and keeps three learning paths separate:

```text
tiny model -> dataset ladder -> checkpoints
single chat -> conversation session -> context memory
the-verdict -> raw text continuation training
GPT-2 -> instruction prompt -> optional instruction SFT
GPT-2 -> frozen base -> LoRA adapters -> merged checkpoint
custom instruction examples -> train/eval split -> custom SFT
checkpoint versions -> experiment comparison -> model selection
streamed tokens -> cancel running jobs -> responsive UI
prompt template -> rendered prompt -> inference mode comparison
local checkpoint -> external provider -> same-prompt comparison
runtime profile -> resource estimate -> deployment checklist
```

## What Was Added

- `apps/web`: a minimal Next.js learning console.
- GPT Model view: inspect the local GPTModel build order from token ids to logits.
- Training Config view: learn how TrainingConfig knobs change the training loop.
- Chat view: stream token events from a selected model and cancel the active stream.
- Conversation view: keep multi-turn sessions and preview which history enters context.
- Prompt Lab view: preview rendered prompts, compare prompt templates, and switch inference modes.
- External view: compare a local model with an OpenAI-compatible or Ollama provider.
- Deploy view: inspect runtime limits and estimate inference/training resource shape.
- From Scratch view: train the tiny model on small chat-shaped datasets.
- Raw Text view: train on The Verdict as larger continuation text.
- GPT-2 view: download and load GPT-2 pretrained weights.
- Instruction view: prepare instruction data, load GPT-2, then fine-tune on instruction/response examples.
- LoRA view: freeze GPT-2, train low-rank adapters, then save a merged checkpoint.
- Chat SFT view: freeze GPT-2, train LoRA on multi-turn chat transcripts, then test the checkpoint in Conversation.
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

The Web UI shows the same runtime in the top bar. CPU is fine for the tiny from-scratch lessons. GPT-2 instruction SFT, LoRA, and Chat SFT should use CUDA for reasonable training time; CPU should be treated as a short smoke test only. Setup steps are in [GPU Runtime Setup for PyTorch](gpu-runtime.md).

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
4. Open Conversation, send `My name is Rojar. Please remember it.`, then preview `What is my name?`.
5. Compare the stored session transcript with the model `context_length` warning.
6. Open Prompt Lab, preview the same message with `raw`, `chat`, `instruction`, and `custom`, then compare `greedy`, `focused`, and `creative`.
7. Configure a real external provider, then open External and compare it with a local model.
8. Inspect the provider request preview and confirm the browser never receives provider credentials.
9. Open Deploy, estimate `random-tiny-byte`, then increase context and concurrency to see which costs grow.
10. Open From Scratch and run `every-effort`, then compare before/after.
11. Open Raw Text; the UI should select `the-verdict` and suggest `random-tiny-byte` plus `trained-verdict-byte`.
12. Run the The Verdict job to observe raw text continuation on a larger dataset.
13. Open GPT-2 and load `GPT-2 small`.
14. Return to Chat and ask an instruction-style request such as `Explain what a model checkpoint is in one sentence.`
15. Open Instruction; the UI should select `instruction-following` and show the three-step loop: instruction data, GPT-2 base, instruction SFT.
16. Click `Download dataset` if the instruction data is missing. The panel should then show one dataset example and the formatted Chapter 7 model input.
17. Load `GPT-2 small`, run instruction SFT, then compare `Before (raw GPT-2)` with `After (instruction SFT)`.
18. Open LoRA; the UI should select `instruction-lora` and show LoRA adapter training.
19. Run LoRA and compare trainable parameter percentage against full instruction SFT.
20. Open Chat SFT; the UI should select `chat-sft-lora` and show multi-turn chat transcript training.
21. Run Chat SFT with CUDA, then load `gpt2-chat-lora`.
22. Open Conversation, select `gpt2-chat-lora`, choose `Chat transcript`, and test `My name is Rojar` followed by `What is my name?`.
23. Open Dataset Builder; inspect seeded examples, add a `train` example, and add an `eval` example.
24. Run custom SFT with `instruction-builder` and compare `Before (GPT-2 base)` with `After (custom SFT)`.
25. Open Experiments to compare raw pretrained GPT-2, full SFT, LoRA, Chat SFT, and custom SFT.
26. Read the comparison summary before reading generated samples.
27. Open Checkpoints to inspect model version lineage and load a specific version.
28. Return to Chat, send a streaming request, and cancel it before `max_new_tokens` is reached.

## Why This Separation Matters

The Verdict teaches the model to continue raw text. It does not teach GPT-2 to answer user requests.

GPT-2 question/request behavior uses the Chapter 7 instruction prompt format. Better instruction following comes from the `instruction-following` SFT dataset, not from The Verdict.

The dataset-size stage is available in [Dataset ladder and training experiments](dataset-ladder-experiments.md).
The foundation stage is explained in [Model Foundations](model-foundations.md).
GPT-2 loading and instruction prompts are explained in [GPT-2 Pretrained and Instruction Prompts](gpt2-pretrained.md).
LoRA is explained in [LoRA / Parameter-Efficient Fine-Tuning](lora-peft.md).
Minimal chat fine-tuning is explained in [Minimal GPU Chat Model](minimal-chat-model.md).
Dataset Builder is explained in [Training Data Management and Dataset Builder](dataset-builder.md).
Model versioning is explained in [Model Versions and Experiment Comparison](model-version-experiment-comparison.md).
Streaming and cancellation are explained in [Streaming Chat and Job Cancellation](streaming-chat-cancel.md).
Inference modes and prompt templates are explained in [Inference Modes and Prompt Template Playground](inference-prompt-playground.md).
External providers are explained in [External Model Integration](external-model-integration.md).
Deployment resource limits are explained in [Deployment and Resource Limits](deployment-resource-limits.md).
Multi-turn sessions are explained in [Multi-Turn Conversation Memory](conversation-memory.md).
GPU setup is explained in [GPU Runtime Setup for PyTorch](gpu-runtime.md).
