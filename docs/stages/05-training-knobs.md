# Stage 05 · Training knobs

[English](05-training-knobs.md) | [繁體中文](05-training-knobs.zh-TW.md)

**Part 2 · Train** — Stage 5 of 17 · [Course index](../README.md)

## Focus

Hyperparameters change the loop, not the architecture.

## Prerequisites

- **Stage 04 · Training loop** — you have run one training job at the default settings and
  watched loss fall.

## Concept

Nothing in `GPTModel` changes in this stage. Every knob below belongs to `TrainingConfig`,
which controls how data is fed to the model and how large each correction is.

| Knob | Default | What it changes |
| --- | --- | --- |
| `max_steps` | 80 | How many optimizer updates run. More chances to fit. |
| `batch_size` | 4 | Windows per update. Larger smooths gradients, costs memory. |
| `block_size` | 32 | Token window length. Longer teaches longer context, costs memory. |
| `stride` | 1 | How far the window moves through the text. Smaller means more overlap. |
| `learning_rate` | 3e-3 | Step size. The stability knob. |
| `eval_every` | 10 | Logging frequency only. Does not affect the model. |
| `sample_prompt` | `Every effort moves you` | Fixed prompt for the before/after comparison. |
| `sample_tokens` | 24 | Length of that comparison sample. |
| `prompt_style` | `chat` | How the sample prompt is wrapped. |
| `seed` | 123 | Reproducibility of initialization and shuffling. |

Three relationships are worth holding in your head:

**Tokens per step = `batch_size × block_size`.** At the defaults that is 128 tokens per update.
Multiply by `max_steps` and compare against your dataset size to see how many times the model
reads the same text.

**Window count = `(len(token_ids) - block_size) / stride`.** This is how many distinct training
examples the dataset produces. Raise `block_size` on a small dataset and the example count
collapses — that is why `every-effort` raises `Training text is too short for block_size=N`.

**`block_size` cannot exceed `context_length`.** The tiny model's position table holds 64
entries, so 64 is a hard ceiling here, not a preference.

The one knob that behaves differently from the rest is `learning_rate`. The others trade
speed against memory. Learning rate trades speed against *stability*: too high and the loss
oscillates or becomes `nan`; too low and it barely moves. It is the only knob that can destroy
a run outright.

## Run it

Change one knob at a time, keeping everything else at its default, and record the final loss
for each run.

### Steps — does more time help?

```cmd
python scripts\smoke_train.py --max-steps 20 --eval-every 5
python scripts\smoke_train.py --max-steps 200 --eval-every 20
```

### Learning rate — the stability knob

```cmd
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --learning-rate 0.05
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --learning-rate 0.00003
```

### Window size — how much context per example

```cmd
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --block-size 16
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --block-size 64
```

### Batch size — how smooth each correction is

```cmd
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --batch-size 1
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --batch-size 8
```

### In the console

> The stage ladder ships in Phase 2 of the restructure. Until then the same controls live in
> the legacy console tab **Training Config**.

## What to observe

1. **`max_steps` moves the finish line, not the slope.** Twenty steps stops early on the same
   curve; two hundred flattens out once there is nothing left to learn.
2. **`learning_rate=0.05` misbehaves.** Expect oscillation or `nan`. This is the failure mode
   you should see at least once on purpose.
3. **`learning_rate=0.00003` barely moves the loss** in 80 steps — the same symptom as "not
   training at all", from the opposite direction.
4. **`--block-size 64` reduces the number of training windows** on this tiny file, so each
   step reuses more of the same data.
5. **`--batch-size 1` produces a noisier loss curve** than `--batch-size 8` at the same step
   count, while seeing one quarter as many tokens.
6. **`eval_every` changes nothing about the result** — only how often you see it. Prove it to
   yourself; it is the cheapest way to learn what "logging" means.

## Exit check

You may continue when all of these are true:

- [ ] You can compute tokens-per-step from `batch_size` and `block_size`.
- [ ] You have made a run diverge with a high learning rate, on purpose.
- [ ] You can explain why `block_size` has a hard ceiling of `context_length`.
- [ ] You can name the one knob in the table that cannot change the trained model.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Training text is too short for block_size=N` | Window longer than the dataset | Lower `block_size`, or move to Stage 06's larger datasets |
| `nan` loss | Learning rate too high | Return to `3e-3` and approach the limit gradually |
| Two identical settings give different results | The seed changed, or the device changed | `TrainingConfig.seed` defaults to 123; keep the device constant |
| Loss curve looks flat but the sample improved | `eval_every` too coarse to show the drop | Lower `eval_every`; it costs nothing |

## Code map

| What | Where |
| --- | --- |
| `TrainingConfig` and every default above | [`training.py`](../../packages/llm_core/llm_core/training.py) |
| Window construction from `block_size` and `stride` | `TokenDataset.__init__` in the same file |
| `DataLoader`, `AdamW`, and the step counter | `train_tiny_language_model` in the same file |
| Server-side ranges for the same knobs | [`apps/api/main.py`](../../apps/api/main.py) → `TrainingRequest` |
| CLI flags | [`scripts/smoke_train.py`](../../scripts/smoke_train.py) |

## Next stage

[**Stage 06 · Data scale**](06-data-scale.md) — the knob that is not in `TrainingConfig` at
all, and the one that matters most.
