# Stage 06 · Data scale

[English](06-data-scale.md) | [繁體中文](06-data-scale.zh-TW.md)

**Part 2 · Train** — Stage 6 of 17 · [Course index](../README.md)

## Focus

Better data beats more steps.

## Prerequisites

- **Stage 05 · Training knobs** — you have pushed `max_steps` and `learning_rate` around and
  seen that neither one produces a better model on `every-effort`.

## Concept

Stage 04 called overfitting a success. This is the stage where it stops being one.

`every-effort` contains the same two lines four times. A model that reproduces it has learned
a lookup table, not a language. The only way past that ceiling is more and more varied data,
so this project ships a ladder of four datasets you climb in order:

| Dataset | Tier | Recommended steps | Block | Prompt style | What it adds |
| --- | --- | --- | --- | --- | --- |
| `every-effort` | tiny | 80 | 32 | `chat` | The baseline you already ran |
| `every-effort-expanded` | small | 140 | 32 | `chat` | More variety in the same shape |
| `learning-dialogues` | medium | 220 | 32 | `chat` | Enough examples to generalize a little |
| `the-verdict` | larger | 320 | 64 | `raw` | Real prose, and a different objective |

The first three are chat-shaped: `User: ... / Assistant: ...`. `the-verdict` is different in a
way that matters more than its size — it is **raw text**, trained with `prompt_style: raw` and
the objective `raw-text`. There is no user and no assistant. The model learns to continue
prose, which is exactly what pretraining is.

Do not expect `the-verdict` to make the model answer questions. Continuation and instruction
following are different skills learned from different data; that distinction is the whole
reason Part 3 and Part 4 exist.

Each dataset also carries its own prompts:

- `comparison_prompt` — used for the before/after sample, so the comparison is fair.
- `dataset_probe_prompt` — a phrase representative of that dataset, for poking at behavior.

For `the-verdict` both are `I had always thought Jack Gisburn`, because asking a
continuation model "what is a checkpoint?" tells you nothing.

`the-verdict` is downloaded on demand into `data/external/`, which is git-ignored.

## Run it

### Prepare the dataset

```cmd
curl -s http://127.0.0.1:8000/training/datasets
curl -s -X POST http://127.0.0.1:8000/training/datasets/the-verdict/prepare
```

### Climb the ladder

Each run uses that dataset's recommended settings and its own output model id:

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"every-effort-expanded\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-small-byte\",\"max_steps\":140,\"eval_every\":20,\"load_when_complete\":true}"

curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"learning-dialogues\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-medium-byte\",\"max_steps\":220,\"eval_every\":20,\"load_when_complete\":true}"
```

### Raw text on The Verdict

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"the-verdict\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-verdict-byte\",\"max_steps\":320,\"eval_every\":40,\"batch_size\":4,\"block_size\":64,\"learning_rate\":0.003,\"sample_prompt\":\"I had always thought Jack Gisburn\",\"load_when_complete\":true}"
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 06 · Data scale** on the ladder.

## What to observe

1. **Final loss goes *up* as you climb.** `every-effort` approaches zero; `the-verdict` does
   not come close. Higher loss on harder data is progress, not regression.
2. **The samples get worse before they get better.** Memorized text looks fluent. Genuinely
   learned text from a 136k-parameter model looks rough. Trust the dataset, not the prettiness.
3. **`the-verdict` output continues prose.** Send `I had always thought Jack Gisburn` and the
   model keeps writing. Send a question and it will keep writing too — it has no notion of
   being asked anything.
4. **`block_size` rises to 64 for The Verdict** and cannot go higher: that is the tiny model's
   `context_length` ceiling from Stage 05.
5. **The same base model produces four different checkpoints.** `random-tiny-byte` is the
   parent of all four; Stage 07 is about reading that lineage.

## Exit check

You may continue when all of these are true:

- [ ] You have trained on at least three rungs of the ladder.
- [ ] You can explain why a higher final loss can indicate a better experiment.
- [ ] You can state the difference between the `chat` and `raw` prompt styles.
- [ ] You can explain why The Verdict will not make a model follow instructions.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Dataset `status` is not `ready` | The file has not been downloaded | `POST /training/datasets/{id}/prepare` |
| Download fails | No network access | The Verdict and the instruction data are fetched on demand; retry |
| `Training text is too short for block_size=64` | Using 64 on a tiny dataset | 64 is for The Verdict; keep 32 on the smaller rungs |
| Verdict output is repetitive | Greedy decoding of a small model on hard data | Revisit the Stage 03 knobs; the ceiling here is model size |

## Code map

| What | Where |
| --- | --- |
| All four dataset specs and their recommended settings | [`dataset_registry.py`](../../apps/api/services/dataset_registry.py) |
| Download-on-demand | [`training_service.py`](../../apps/api/services/training_service.py) → `prepare_dataset` |
| Dataset files | `data/tiny/`, `data/small/`, `data/medium/`, `data/external/` |
| `GET /training/datasets`, `POST /training/datasets/{id}/prepare` | [`training.py`](../../apps/api/routers/training.py) |

## Next stage

[**Stage 07 · Checkpoints**](07-checkpoints.md) — you now have four trained models. This is
how you tell them apart six months from now.
