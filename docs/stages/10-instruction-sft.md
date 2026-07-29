# Stage 10 · Instruction SFT

[English](10-instruction-sft.md) | [繁體中文](10-instruction-sft.zh-TW.md)

**Part 4 · Align** — Stage 10 of 17 · [Course index](../README.md)

## Focus

Training on (instruction, response) pairs is what makes a model answer.

## Prerequisites

- **Stage 09 · Prompt format** — you have tried every template on GPT-2 and confirmed that
  none of them turns a continuation model into an assistant.
- CUDA is strongly recommended from here on. See the [GPU runtime reference](../reference/gpu-runtime.md).

## Concept

Everything in Part 2 trained on plain text: the target was simply the next token in the file.
Supervised fine-tuning changes *what* the text is, not how the loop works.

The `instruction-following` dataset is a list of examples shaped like this:

```json
{ "instruction": "...", "input": "", "output": "..." }
```

`InstructionDataset` renders each one into a single training string using the same instruction
template you met in Stage 09:

```
Below is an instruction that describes a task. Write a response that
appropriately completes the request.

### Instruction:
{instruction}

### Response:
{output}
```

Then it trains on that string exactly as Stage 04 trained on `every-effort` — next-token
prediction, cross-entropy, AdamW. **The mechanism is unchanged.** What changed is that the
text now demonstrates the behavior you want: after `### Response:`, an answer follows.

That is the entire idea behind instruction tuning. The model does not learn "obedience"; it
learns that this particular prompt shape is followed by a completion of a particular kind.

Two practical differences from Part 2:

**The learning rate drops by roughly 60×**, from `3e-3` to `5e-5`. You are adjusting a model
that already works, not building one from noise. Large steps here destroy existing ability —
the failure mode has a name, catastrophic forgetting, and a high learning rate is the fastest
route to it.

**Every parameter is trainable.** All ~124 million weights receive gradients, plus AdamW keeps
two optimizer states per parameter. That memory cost is the motivation for Stage 11.

## Run it

### Prepare the dataset

```cmd
curl -s -X POST http://127.0.0.1:8000/training/datasets/instruction-following/prepare
```

### Confirm the runtime before a long run

```cmd
curl -s http://127.0.0.1:8000/health
```

If `device` is `cpu`, keep `max_steps` very small and treat the run as a smoke test.

### Capture the "before" answer

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":80,\"inference_mode\":\"focused\"}"
```

### Fine-tune

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-following\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-instruct-finetuned\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.00005,\"sample_prompt\":\"Explain what a model checkpoint is in one sentence.\",\"load_when_complete\":true}"
```

### Ask the same question again

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-instruct-finetuned\",\"max_new_tokens\":80,\"inference_mode\":\"focused\"}"
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 10 · Instruction SFT** on the ladder.

## What to observe

1. **The before/after pair is the whole stage.** Base GPT-2 continues; the fine-tuned model
   attempts an answer. Read both in full before looking at any number.
2. **Twenty steps is enough to change behavior visibly.** Alignment is a much smaller
   intervention than pretraining.
3. **`batch_size` is 1 and `block_size` is 256.** Instruction examples are long, and full
   fine-tuning of 124M parameters is memory-hungry — the two constraints push in the same
   direction.
4. **Quality is still poor.** A few hundred examples and twenty steps produce the *shape* of
   an answer, not a good one. That distinction is worth sitting with.
5. **The training summary reports `training_objective: instruction-sft`.** Stage 14 uses that
   field to refuse unfair comparisons.
6. **Watch the memory.** On CPU this is slow; on a small GPU it may not fit at all. That number
   is the argument for the next stage.

## Exit check

You may continue when all of these are true:

- [ ] You can explain what changed relative to Stage 04 — and what did not.
- [ ] You can explain why the learning rate is ~60× smaller than in Part 2.
- [ ] You have a before/after pair for the same prompt, saved or screenshotted.
- [ ] You can name the resource cost that motivates LoRA.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Dataset `status` is not `ready` | Instruction data not downloaded | `POST /training/datasets/instruction-following/prepare` |
| CUDA out of memory | Full fine-tuning of 124M parameters | Lower `block_size`, keep `batch_size` at 1, or jump to Stage 11 |
| Output got *worse* after tuning | Learning rate too high, or too many steps on tiny data | Return to `5e-5`; reload `gpt2-124M` and retry |
| Training takes many minutes per step | Running on CPU | Expected. Install CUDA PyTorch, restart the API |
| `Unknown base_model_id: gpt2-124M` | GPT-2 was never loaded, or the API restarted | Redo Stage 08's load job |

## Code map

| What | Where |
| --- | --- |
| Instruction example rendering | [`training.py`](../../packages/llm_core/llm_core/training.py) → `InstructionDataset` |
| The instruction template | [`generation.py`](../../packages/llm_core/llm_core/generation.py) → `format_instruction_prompt` |
| Dataset spec and recommended settings | [`dataset_registry.py`](../../apps/api/services/dataset_registry.py) → `instruction-following` |
| `POST /training/jobs` | [`training.py`](../../apps/api/routers/training.py) |

## Next stage

[**Stage 11 · LoRA**](11-lora.md) — the same behavior change, training roughly one percent as
many parameters.
