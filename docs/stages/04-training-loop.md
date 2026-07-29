# Stage 04 · Training loop

[English](04-training-loop.md) | [繁體中文](04-training-loop.zh-TW.md)

**Part 2 · Train** — Stage 4 of 17 · [Course index](../README.md)

## Focus

Loss is the signal that turns data into weights.

## Prerequisites

- **Stage 03 · Decoding** — you have generated text from `random-tiny-byte` and seen that
  changing `temperature` and `top_k` changes the shape of the output but never its quality.

You are about to fix that, and the fix is the first thing in this course that changes the
model itself.

## Concept

Everything in Part 1 was inference: the weights were random and stayed random. Training is a
loop that repeats four steps until you stop it:

```
  batch ──▶ model ──▶ logits ──▶ cross_entropy(logits, targets) ──▶ loss
                                                                     │
    weights ◀── optimizer.step() ◀── gradients ◀── loss.backward() ◀─┘
```

Three ideas make that loop work.

**1. The training signal is free.** No one labels this data. `TokenDataset` slides a window
of `block_size` over the token ids and pairs each window with the *same window shifted by
one*:

```
ids      = [ 85, 115, 101, 114, 58, 32, 69, ... ]
input    = [ 85, 115, 101, 114, 58, 32 ]
target   = [ 115, 101, 114, 58, 32, 69 ]
```

The model's job at every position is to predict the next id. The answer is already in the
text, which is why raw text is enough to train on.

**2. Loss measures surprise.** `cross_entropy` compares the model's score distribution
against the one correct id. A model guessing uniformly over 257 ids scores
`ln(257) ≈ 5.55`. That number is your baseline: at step 1 the untrained model should be near
it, and every point below it is knowledge the model did not have before.

**3. One step is one batch.** `max_steps=80` does not mean 80 passes over the data — it means
80 batches of `batch_size` windows. `AdamW` adjusts every trainable parameter after each one.

The dataset for this stage, `every-effort`, is four repetitions of the same two lines. It is
supposed to be trivial. A model that memorizes a tiny dataset has **overfit**, and overfitting
is the cheapest possible proof that learning happened at all. Stage 06 is where that stops
being a good thing.

## Run it

### From the command line

```cmd
python scripts\smoke_train.py --max-steps 80 --eval-every 10
```

The script generates a sample *before* training, runs the loop, generates a sample *after*,
and saves a checkpoint.

### Against the API

Start a training job:

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"every-effort\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-tiny-byte\",\"max_steps\":80,\"eval_every\":10,\"load_when_complete\":true}"
```

Poll it with the returned `job_id`:

```cmd
curl -s "http://127.0.0.1:8000/training/jobs/<JOB_ID>"
```

Then send the same prompt to `/chat` twice — once with `"model_id":"random-tiny-byte"`, once
with `"model_id":"trained-tiny-byte"` — and compare.

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 04 · Training loop** on the ladder.

## What to observe

1. **The before sample** is escaped bytes — the Stage 03 baseline, printed again so the
   comparison is in one place.
2. **Step 1 loss** is close to `5.55`. The model starts out as an expensive coin flip over
   257 possibilities.
3. **Loss falls fast and far** over 80 steps. On a dataset this small it should approach zero,
   because there is almost nothing to learn.
4. **`tokens_seen` grows by `batch_size × block_size` per step** — 128 tokens per step at the
   defaults. Compare that to the size of the dataset and you will see the model reads the same
   text many times over.
5. **The after sample contains recognizable fragments of the training text** — pieces like
   `Every`, `forwar`, and `Ast:` instead of random bytes. It does *not* reproduce the sentence
   cleanly, even at 800 steps with the loss near 0.09: a 2-layer, 64-dimension model working one
   byte at a time does not have the capacity. "Learned this file" and "can reproduce this file"
   are different claims, and only the first one is true here.
6. **A checkpoint path is printed.** That file is the entire result of the run — Stage 07 is
   about what is inside it.

## Exit check

You may continue when all of these are true:

- [ ] You can explain where the training targets come from without the word "label".
- [ ] You know what number an untrained byte-tokenizer model's loss starts near, and why.
- [ ] You have compared the same prompt before and after training.
- [ ] You can state why overfitting on `every-effort` is the expected outcome here.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Training text is too short for block_size=N` | `TokenDataset` needs more than `block_size` tokens | Lower `--block-size`, or use a larger dataset from Stage 06 |
| Loss becomes `nan` | Learning rate too high | Drop `--learning-rate` back toward `3e-3` |
| Loss barely moves | Too few steps, or learning rate far too low | Raise `--max-steps`; this is the experiment for Stage 05 |
| After sample still looks random | The job failed, or you compared the wrong `model_id` | Check the job `status` and `error`; confirm `load_when_complete` was `true` |

## Code map

| What | Where |
| --- | --- |
| `TrainingConfig` defaults | [`training.py`](../../packages/llm_core/llm_core/training.py) — `max_steps=80`, `batch_size=4`, `block_size=32`, `learning_rate=3e-3` |
| Window pairing | `TokenDataset.__init__` in the same file |
| The loop itself | `train_tiny_language_model` in the same file |
| Checkpoint writing | [`checkpoints.py`](../../packages/llm_core/llm_core/checkpoints.py) → `save_checkpoint` |
| CLI entry point | [`scripts/smoke_train.py`](../../scripts/smoke_train.py) |
| Dataset registry entry | [`dataset_registry.py`](../../apps/api/services/dataset_registry.py) → `every-effort` |
| `POST /training/jobs` | [`training.py`](../../apps/api/routers/training.py) |

## Next stage

[**Stage 05 · Training knobs**](05-training-knobs.md) — the same loop, with `max_steps`,
`batch_size`, `block_size`, and `learning_rate` moved one at a time so you can see which one
changes speed and which one changes stability.
