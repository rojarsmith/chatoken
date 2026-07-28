# Stage 13 · Your own dataset

[English](13-your-own-dataset.md) | [繁體中文](13-your-own-dataset.zh-TW.md)

**Part 4 · Align** — Stage 13 of 17 · [Course index](../README.md)

## Focus

Your data is the product. Fine-tuning quality is decided before the optimizer starts.

## Prerequisites

- **Stage 12 · Chat SFT** — you have run three fine-tuning jobs on datasets somebody else
  wrote.

## Concept

Every dataset so far arrived ready-made. In real work that never happens: the data is the part
you own, and it is where most of the quality comes from.

The Dataset Builder stores editable examples in `data/custom/instruction-builder.json`, one
JSON object each:

```json
{
  "example_id": "generated-id",
  "split": "train",
  "instruction": "Explain what a model checkpoint is in one sentence.",
  "input": "",
  "output": "A model checkpoint is a saved snapshot of model weights and metadata.",
  "created_at": "...",
  "updated_at": "..."
}
```

The `split` field carries the new idea. Examples marked `train` become optimizer updates.
Examples marked `eval` are stored and never trained on.

That separation is not bookkeeping. A model that has seen an example can reproduce it, which
tells you nothing about whether it learned anything general. Held-out examples are the only
data that can answer that question — and they only work if they are held out *before* you look
at the results.

In the current implementation `eval` examples are saved for inspection rather than scored
automatically. That is an honest limitation, and it is stated here rather than hidden: the
split exists, the discipline is yours to apply.

The pipeline this stage makes visible:

```
instruction example -> train/eval split -> prompt template -> SFT loop -> checkpoint
```

Examples do not teach the model by existing in a file. Only the ones the training reader
selects become gradient updates.

`data/custom/` is git-ignored — it is your local experiment data.

## Run it

### Inspect what is there

```cmd
curl -s http://127.0.0.1:8000/training/dataset-builder
```

### Seed the starter examples if the file is empty

```cmd
curl -s -X POST http://127.0.0.1:8000/training/dataset-builder/seed
```

### Add one training example and one held-out example

```cmd
curl -s -X POST http://127.0.0.1:8000/training/dataset-builder/examples ^
  -H "Content-Type: application/json" ^
  -d "{\"split\":\"train\",\"instruction\":\"Explain loss in one sentence.\",\"input\":\"\",\"output\":\"Loss measures how far the model prediction is from the target token.\"}"

curl -s -X POST http://127.0.0.1:8000/training/dataset-builder/examples ^
  -H "Content-Type: application/json" ^
  -d "{\"split\":\"eval\",\"instruction\":\"Explain overfitting in one sentence.\",\"input\":\"\",\"output\":\"Overfitting is when a model memorizes its training data instead of generalizing.\"}"
```

Edit or remove an example with its `example_id`:

```cmd
curl -s -X PUT http://127.0.0.1:8000/training/dataset-builder/examples/<EXAMPLE_ID> ^
  -H "Content-Type: application/json" ^
  -d "{\"split\":\"train\",\"instruction\":\"...\",\"input\":\"\",\"output\":\"...\"}"

curl -s -X DELETE http://127.0.0.1:8000/training/dataset-builder/examples/<EXAMPLE_ID>
```

### Train on your own data

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-builder\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-builder-finetuned\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.00005,\"load_when_complete\":true}"
```

### Check it against a held-out example

Ask the model an `eval` instruction it was never trained on, and judge the answer yourself.

### In the console

> The stage ladder ships in Phase 2 of the restructure. Until then this lives in the legacy
> console tab **Dataset Builder**.

## What to observe

1. **The train/eval counts are reported separately.** Only the `train` count affects training.
2. **Adding one example changes the trained model.** With a dataset this small, individual
   examples are visible in the output — which is both instructive and a warning.
3. **Your phrasing propagates.** Write terse outputs and you get terse answers. The model
   copies style as readily as content.
4. **The eval example exposes the gap.** Trained instructions come back well; the held-out one
   usually does not. That difference is the only honest signal you have.
5. **`dataset_id: instruction-builder` is recorded** in the experiment log, so Stage 14 knows
   these runs are not comparable with the stock dataset.
6. **The same instruction template from Stage 09 is used.** Your data enters the same pipeline;
   nothing about the format is special.

## Exit check

You may continue when all of these are true:

- [ ] You have added, edited, and deleted an example through the API.
- [ ] You can explain why `eval` examples must not be trained on.
- [ ] You have trained on your own examples and tested one held-out instruction.
- [ ] You can explain why a small dataset makes each example unusually influential.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| The builder dataset is empty | Never seeded | `POST /training/dataset-builder/seed` |
| Training fails with no examples | Every example is marked `eval` | At least one must be `split: train` |
| Changes vanish | `data/custom/` was cleaned; it is git-ignored | Re-seed and re-add; export anything you want to keep |
| Model answers identically to before | Too few train examples, or too few steps | Add examples first, steps second — that is this stage's point |

## Code map

| What | Where |
| --- | --- |
| Builder storage, seeding, CRUD, train/eval filtering | [`training_service.py`](../../apps/api/services/training_service.py) |
| Dataset spec | Same file → `instruction-builder` |
| `GET/POST /training/dataset-builder`, `POST/PUT/DELETE .../examples` | [`apps/api/main.py`](../../apps/api/main.py) |
| Local data file | `data/custom/instruction-builder.json` (git-ignored) |

## Next stage

[**Stage 14 · Compare runs**](14-compare-runs.md) — you now have five or more checkpoints and
several claims about them. Time to check whether the comparisons are valid.
