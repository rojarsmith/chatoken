# Stage 14 · Compare runs

[English](14-compare-runs.md) | [繁體中文](14-compare-runs.zh-TW.md)

**Part 4 · Align** — Stage 14 of 17 · [Course index](../README.md)

## Focus

Compare only what is comparable.

## Prerequisites

- **Stage 13 · Your own dataset** — you have accumulated at least five training runs across
  different datasets, base models, and tuning methods.

## Concept

You now have a pile of checkpoints and a natural question: which one is best? The answer is
usually "that question is not well formed yet."

A loss number means nothing on its own. A run on `every-effort` reaches near-zero loss and is
worthless; a run on `the-verdict` stalls at a much higher number and learned far more. Loss is
only comparable **within** a fixed setup.

So before comparing two runs, five things must match:

```
same prompt?
same dataset?
same base model?
same objective?
same tuning method?
```

`GET /training/experiments/compare` checks exactly these and returns a `same` block —
`prompt`, `dataset`, `baseModel`, `objective`, `tuning` — before any metric. When a field is
`false` the response carries a note explaining what the mismatch invalidates.

The workflow this stage teaches is an order of operations:

1. Read the sameness summary.
2. Read the config difference.
3. *Then* read the loss delta.
4. *Then* read the generated samples.

Reversing that order is how people convince themselves of things that are not true. Generated
text is the most persuasive and least reliable evidence available — it is easy to read
fluency as correctness, and easy to prefer the sample you expected to win.

Every training job appends a record to `models/experiments/training-experiments.jsonl`:
dataset id, training objective, prompt style, base model, output model, loss snapshots, tokens
seen, before/after samples, tuning method, and the checkpoint id. That log is what makes the
comparison possible after the fact, without re-running anything.

## Run it

### List the runs

```cmd
curl -s http://127.0.0.1:8000/training/experiments
```

### A fair comparison — same dataset, different tuning method

Stage 10 (full SFT) against Stage 11 (LoRA): same dataset family, same base, same prompt.

```cmd
curl -s "http://127.0.0.1:8000/training/experiments/compare?left_id=<FULL_SFT_ID>&right_id=<LORA_ID>"
```

### An unfair comparison — run it on purpose

A Part 2 tiny-model run against a Part 4 GPT-2 run:

```cmd
curl -s "http://127.0.0.1:8000/training/experiments/compare?left_id=<EVERY_EFFORT_ID>&right_id=<CHAT_SFT_ID>"
```

Read the `same` block and the notes. This is the more educational of the two calls.

### Cross-check against the checkpoints

```cmd
curl -s http://127.0.0.1:8000/checkpoints
```

### In the console

> The stage ladder ships in Phase 2 of the restructure. Until then this lives in the legacy
> console tabs **Experiments** and **Checkpoints**.

## What to observe

1. **The summary comes first, deliberately.** The API returns sameness before metrics because
   the metrics are meaningless until the sameness is checked.
2. **The unfair comparison reports multiple `false` fields**, each with a note. A lower loss
   here proves nothing.
3. **Full SFT and LoRA are close on output, far apart on `trainable_percent`.** This is the
   one comparison in the course where a real trade-off is visible with everything else held
   constant.
4. **`tuning_method` defaults to `full`** when a run predates LoRA, so older records still
   compare cleanly.
5. **`final_loss` across the dataset ladder is not a ranking.** Line up Stage 06's four runs
   and confirm that the lowest loss belongs to the least useful model.
6. **Before/after samples come from the same `comparison_prompt`** for a given dataset — which
   is why that field exists in the dataset spec.

## Exit check

You may continue when all of these are true:

- [ ] You can list the five fields that must match before a comparison means anything.
- [ ] You have deliberately run an invalid comparison and read the notes.
- [ ] You can explain why the lowest loss in your experiment log is not the best model.
- [ ] You read summary and config before samples, every time.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| The experiment list is empty | No training has run in this clone | `models/experiments/` is git-ignored; run Stage 04 |
| `Unknown experiment id` | Wrong id | Copy ids from `GET /training/experiments` |
| Every field in `same` is `false` | Two unrelated runs | Expected; pick runs that share a dataset and base model |
| Loss delta looks impossible | Different objectives — raw-text vs instruction | Cross-objective loss is not comparable at all |

## Code map

| What | Where |
| --- | --- |
| Experiment record writing | [`training_service.py`](../../apps/api/services/training_service.py) |
| Sameness computation and notes | `compare_experiments` / `_build_comparison` in the same file |
| `GET /training/experiments`, `GET /training/experiments/compare` | [`apps/api/main.py`](../../apps/api/main.py) |
| Experiment log | `models/experiments/training-experiments.jsonl` (git-ignored) |

## Next stage

[**Stage 15 · Conversation memory**](15-conversation-memory.md) — Part 5 begins. The model is
finished; the system around it is not.
