# Stage 11 · LoRA

[English](11-lora.md) | [繁體中文](11-lora.zh-TW.md)

**Part 4 · Align** — Stage 11 of 17 · [Course index](../README.md)

## Focus

The same behavior change, training roughly one percent as many parameters.

## Prerequisites

- **Stage 10 · Instruction SFT** — you have fine-tuned all 124 million GPT-2 weights and paid
  the memory bill for it.

## Concept

Full fine-tuning updates every weight. LoRA — Low-Rank Adaptation — freezes the original model
and trains a small pair of matrices beside each targeted layer instead.

For a frozen linear layer `W` of shape `[out, in]`, LoRA adds two much smaller matrices,
`A` of shape `[rank, in]` and `B` of shape `[out, rank]`:

```
output = W·x  +  (B · A · x) × (alpha / rank)
         ^^^     ^^^^^^^^^^^
         frozen  trainable
```

With `rank=8` against GPT-2's 768-wide attention projections, `A` and `B` together hold about
`8 × 768 × 2 = 12,288` numbers where `W` holds `768 × 768 = 589,824`. That is the entire
saving, repeated at every targeted layer.

The defaults in `LoRAConfig`:

| Field | Default | Meaning |
| --- | --- | --- |
| `rank` | 8 | Width of the bottleneck. Higher fits more, costs more. |
| `alpha` | 16 | Scaling numerator; effective scale is `alpha / rank` = 2. |
| `dropout` | 0.05 | Dropout on the adapter input path only. |
| `target_modules` | `("W_query", "W_value")` | Which layers get adapters. |

Only queries and values are adapted, not keys and not the feed-forward network. This is the
common choice, and it is worth noticing that it is a *choice* — one you can change.

One detail rewards attention: **`lora_b` is initialized to zeros** while `lora_a` uses Kaiming
initialization. At step 0 the product `B·A` is therefore exactly zero, so the adapted model
starts out numerically identical to the frozen base. Training departs from GPT-2 rather than
from noise — that is what makes LoRA safe to attach to a working model.

The flow:

```
load GPT-2 base
  -> freeze every parameter
  -> replace W_query and W_value with LoRA-wrapped linear layers
  -> train only the A/B matrices
  -> merge:  W_merged = W + (B·A) × scaling
  -> save a normal full checkpoint
```

The merge step is why Stage 07's loader still works. The saved artifact is an ordinary full
checkpoint with no adapter format to support. You trade the ability to swap adapters at
runtime for a much simpler system — a reasonable trade for a teaching project, and an explicit
one.

## Run it

### Prepare the dataset

```cmd
curl -s -X POST http://127.0.0.1:8000/training/datasets/instruction-lora/prepare
```

### Train the adapters

Note the learning rate: `3e-4`, six times higher than Stage 10's `5e-5`.

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-lora\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-instruct-lora\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.0003,\"sample_prompt\":\"Explain what a model checkpoint is in one sentence.\",\"load_when_complete\":true}"
```

### Compare against Stage 10 on the same prompt

```cmd
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-instruct-finetuned\",\"max_new_tokens\":80,\"inference_mode\":\"focused\"}"
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-instruct-lora\",\"max_new_tokens\":80,\"inference_mode\":\"focused\"}"
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 11 · LoRA** on the ladder.

## What to observe

1. **`trainable_percent` is the headline.** The training summary reports
   `trainable_parameters`, `total_parameters`, and their ratio. Compare it against Stage 10,
   where the ratio was 100%.
2. **The output quality is broadly comparable.** Two very different parameter counts, similar
   behavior change — that is the claim LoRA makes, and you can check it here.
3. **The learning rate is six times higher.** Fewer parameters carry the whole adjustment, so
   each one moves further. Reusing `5e-5` here does almost nothing.
4. **Memory use drops.** Gradients and AdamW state exist only for the adapters. Frozen weights
   still occupy memory for the forward pass — this reduces training cost, not model size.
5. **The saved checkpoint looks completely ordinary.** `GET /checkpoints` shows a full
   snapshot; only `tuning_method: lora` reveals how it was produced.
6. **It is still slow on CPU.** Fewer trainable parameters, but every step still runs a full
   GPT-2 forward and backward pass.

## Exit check

You may continue when all of these are true:

- [ ] You can explain what `rank` controls and why `alpha / rank` appears in the forward pass.
- [ ] You can explain why zero-initializing `lora_b` matters.
- [ ] You can name which GPT-2 layers received adapters and which did not.
- [ ] You can explain why the saved checkpoint needs no adapter loader.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Training has no trainable parameters` | Everything froze and no adapter was attached | Confirm `target_modules` matches real layer names (`W_query`, `W_value`) |
| Loss barely moves | Learning rate carried over from full SFT | Use `3e-4`, not `5e-5` |
| No memory saving observed | Frozen weights still need forward-pass memory | Expected — the saving is in gradients and optimizer state |
| Output identical to base GPT-2 | Too few steps, or the merge did not run | Check the job summary for `tuning_method` and `trainable_parameters` |

## Code map

| What | Where |
| --- | --- |
| `LoRAConfig`, `LoRALinear`, `apply_lora`, `merge_lora` | [`lora.py`](../../packages/llm_core/llm_core/lora.py) |
| Zero-init of `lora_b`, Kaiming init of `lora_a` | `LoRALinear.__init__` in the same file |
| Merge arithmetic | `LoRALinear.merged_linear` in the same file |
| Dataset spec and recommended settings | [`dataset_registry.py`](../../apps/api/services/dataset_registry.py) → `instruction-lora` |

## Next stage

[**Stage 12 · Chat SFT**](12-chat-sft.md) — the same adapter technique pointed at multi-turn
transcripts, plus one new idea about which tokens the loss should cover.
