# Chatoken Course

[English](README.md) | [繁體中文](README.zh-TW.md)

Build a minimal ChatGPT-like system from scratch, one idea at a time.

This is the ordered index for the whole project. Start at Stage 01 and go down. Each stage
teaches **exactly one new idea**, builds on the stage before it, and ends with a checklist you
can use to decide whether to move on.

> **Console status.** The stage ladder is live at `http://127.0.0.1:3000`. Stages 01–03 have
> interactive panels; the remaining stages appear on the ladder and link to their document plus
> the legacy console tab that still holds those controls. The original 16-tab console stays
> reachable at `/legacy` until every stage is migrated. See the
> [restructure plan](restructure-plan.md) for the schedule.

## Before you start

Set up the virtual environment, the API, and the console: [Setup](reference/setup.md).
You need Windows CPython 3.11–3.13; PyTorch wheels are not available for 3.14 in this setup.

## The ladder

### Part 1 · Generate — *a model can produce tokens*

| | Stage | The one new idea |
| --- | --- | --- |
| 01 | [Tokens](stages/01-tokens.md) | The model never sees text, only integer ids |
| 02 | [Forward pass](stages/02-forward-pass.md) | Ids → embeddings → blocks → logits |
| 03 | [Decoding](stages/03-decoding.md) | Sampling controls shape, not knowledge |

### Part 2 · Train — *a model can learn from data*

| | Stage | The one new idea |
| --- | --- | --- |
| 04 | [Training loop](stages/04-training-loop.md) | Loss is the learning signal |
| 05 | [Training knobs](stages/05-training-knobs.md) | Hyperparameters change the loop, not the architecture |
| 06 | [Data scale](stages/06-data-scale.md) | Better data beats more steps |
| 07 | [Checkpoints](stages/07-checkpoints.md) | A model is a file with lineage |

### Part 3 · Reuse — *stand on someone else's training*

| | Stage | The one new idea |
| --- | --- | --- |
| 08 | [Pretrained GPT-2](stages/08-pretrained-gpt2.md) | Same architecture, someone else paid for the compute |
| 09 | [Prompt format](stages/09-prompt-format.md) | Formatting changes behavior with zero weight change |

### Part 4 · Align — *make it follow instructions and hold a conversation*

| | Stage | The one new idea |
| --- | --- | --- |
| 10 | [Instruction SFT](stages/10-instruction-sft.md) | Training on (instruction, response) pairs makes a model answer |
| 11 | [LoRA](stages/11-lora.md) | The same behavior change with ~1% trainable parameters |
| 12 | [Chat SFT](stages/12-chat-sft.md) | Multi-turn transcripts teach turn-taking |
| 13 | [Your own dataset](stages/13-your-own-dataset.md) | Your data is the product |
| 14 | [Compare runs](stages/14-compare-runs.md) | Compare only what is comparable |

### Part 5 · Ship — *turn a model into a system*

| | Stage | The one new idea |
| --- | --- | --- |
| 15 | [Conversation memory](stages/15-conversation-memory.md) | The model is stateless; the application supplies memory |
| 16 | [Streaming & cancel](stages/16-streaming-cancel.md) | Tokens arrive one at a time and users must be able to stop |
| 17 | [Deploy & limits](stages/17-deploy-limits.md) | Cost is context length × concurrency |

## Optional track

Not on the ladder — it teaches integration rather than model building, and nothing later
depends on it. Take it any time after Stage 09.

| Track | Idea |
| --- | --- |
| [External providers](tracks/external-models.md) | Compare your model against a hosted one |

## Reference

Look these up when you need them; they are not part of the sequence.

| Document | Use it for |
| --- | --- |
| [Setup](reference/setup.md) | Virtual environment, dependencies, first run |
| [GPU runtime](reference/gpu-runtime.md) | CUDA setup for PyTorch — needed from Stage 10 for reasonable training times |
| [API](reference/api.md) | Every endpoint, grouped by stage |
| [Architecture](reference/architecture.md) | How `llm_core`, the API, and the console fit together |
| [Glossary](reference/glossary.md) | Terms in one place: logits, loss, checkpoint, adapter, context window |
| [Troubleshooting](reference/troubleshooting.md) | Symptoms and fixes collected from every stage |

## How each stage is written

Every stage document has the same shape, so you can learn the format once:

| Section | What it gives you |
| --- | --- |
| **Focus** | One sentence: the single new idea |
| **Prerequisites** | The previous stage and what it produced |
| **Concept** | The explanation — short, one diagram at most |
| **Run it** | Command line, API, and console paths to the same result |
| **What to observe** | The exact values to look at, named |
| **Exit check** | The checklist that says you are ready to continue |
| **Common problems** | Symptom → cause → fix |
| **Code map** | The files and functions this stage touches |
| **Next stage** | Where the next idea comes from |

Every document has an English and a 繁體中文 version, with a switch link at the top.

## About the restructure

The reasoning behind this course layout — what was wrong with the previous structure, the
target architecture, and the phase-by-phase plan — is in the
[restructure plan](restructure-plan.md).
