# LoRA / Parameter-Efficient Fine-Tuning

[English](lora-peft.md) | [繁體中文](lora-peft.zh-TW.md)

This stage teaches parameter-efficient fine-tuning after full instruction SFT.

The goal is to show that the model can adapt by training a small number of adapter parameters instead of updating every GPT-2 weight.

## What This Project Implements

LLM ABC uses a minimal local LoRA implementation in `packages/llm_core/llm_core/lora.py`.

Training flow:

```text
load GPT-2 base
-> freeze base weights
-> replace attention W_query and W_value with LoRA-wrapped linear layers
-> train only LoRA A/B matrices
-> merge LoRA weights back into the base linear layers
-> save a full checkpoint
```

The current checkpoint remains a full merged model snapshot so the existing checkpoint loader can load it without needing a separate adapter format.

## What Changes Compared With Full SFT

Full instruction SFT:

```text
all GPT-2 parameters require gradients
```

LoRA:

```text
base GPT-2 parameters are frozen
only low-rank adapter matrices require gradients
```

The Web UI and experiment records show:

- `tuning_method`
- `trainable_parameters`
- `total_parameters`
- `trainable_percent`
- LoRA rank, alpha, dropout, and target modules

## Run From the API

Start with GPT-2 small loaded as `gpt2-124M`, then prepare the instruction dataset:

```cmd
curl -s -X POST http://127.0.0.1:8000/training/datasets/instruction-lora/prepare
```

Start the LoRA job:

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-lora\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-instruct-lora\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.0003,\"sample_prompt\":\"Explain what a model checkpoint is in one sentence.\",\"load_when_complete\":true}"
```

## Learning Checkpoint

Before moving on, learners should be able to explain:

1. Which GPT-2 weights were frozen.
2. Which attention layers received LoRA adapters.
3. Why trainable parameter count is much smaller than total parameter count.
4. Why this implementation saves a merged full checkpoint.
5. Why LoRA still benefits from CUDA even though fewer parameters are trained.
