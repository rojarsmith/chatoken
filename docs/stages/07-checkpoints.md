# Stage 07 · Checkpoints

[English](07-checkpoints.md) | [繁體中文](07-checkpoints.zh-TW.md)

**Part 2 · Train** — Stage 7 of 17 · [Course index](../README.md)

## Focus

A model is a file with lineage.

## Prerequisites

- **Stage 06 · Data scale** — you have several trained models and no reliable way to tell
  which is which.

## Concept

Every training run in this project writes one `.pt` file to `models/checkpoints/`. That file
is the entire result. Open it and you find seven things:

```
checkpoint_id      unique id derived from model_id and timestamp
model_id           what this model is called
base_model_id      what it was trained from        ← lineage
created_at         when
version            version_id, version_label, lineage, run_config, metrics
model_config       vocab_size, context_length, emb_dim, n_heads, n_layers, ...
tokenizer          "byte" or "gpt2"
training_summary   losses, tokens_seen, before/after samples
state_dict         every weight in the model
```

Three properties of this format are worth understanding.

**It is a full snapshot, not a delta.** Loading a checkpoint does not require replaying
earlier ones. This differs from adapter or patch formats — including LoRA, which you meet in
Stage 11 — where only the difference from a base model is stored. Chatoken merges LoRA back
into a full checkpoint precisely so that one loader handles every model.

**It does not contain code.** `state_dict` is a dictionary of tensors keyed by layer name.
Reconstructing the model requires the `GPTModel` source *and* the saved `model_config`. Change
the architecture and old checkpoints stop loading — which is why the config travels with the
weights.

**It records where it came from.** `base_model_id` plus `run_config` answers "what produced
this?" without any external notes. That metadata is what makes Stage 14's comparison possible;
a loss number without its run context is not evidence of anything.

## Run it

### List what you have

```cmd
curl -s http://127.0.0.1:8000/checkpoints
```

### Load a specific version as a chat model

```cmd
curl -s -X POST http://127.0.0.1:8000/models/load ^
  -H "Content-Type: application/json" ^
  -d "{\"checkpoint_id\":\"YOUR_CHECKPOINT_ID\",\"model_id\":\"trained-tiny-byte\"}"
```

### Confirm it is serving

```cmd
curl -s http://127.0.0.1:8000/models

curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"trained-tiny-byte\",\"max_new_tokens\":24}"
```

### Inspect a checkpoint file directly

```cmd
python -c "import torch; p = torch.load(r'models/checkpoints/YOUR_FILE.pt', map_location='cpu'); print(list(p.keys())); print(p['base_model_id'], p['tokenizer']); print(list(p['state_dict'].keys())[:5])"
```

### In the console

> The stage ladder ships in Phase 2 of the restructure. Until then this lives in the legacy
> console tab **Checkpoints**.

## What to observe

1. **Every checkpoint names its parent.** All four models from Stage 06 report
   `base_model_id: random-tiny-byte` — same parent, different data.
2. **`run_config` recovers the experiment.** Dataset, `max_steps`, and `learning_rate` are in
   the file, so a run is reproducible from the artifact alone.
3. **`metrics.final_loss` differs sharply across the ladder** and matches what you watched
   scroll past during training.
4. **`state_dict` keys mirror the module tree** from Stage 02: `tok_emb.weight`,
   `pos_emb.weight`, `trf_blocks.0.att.W_query.weight`, and so on. The file is a direct image
   of the architecture.
5. **`load_when_complete: true` did this automatically** in earlier stages. Doing it by hand
   once shows you the step that was hidden.
6. **Older checkpoints without version metadata still load.** The API derives a fallback
   version from the payload rather than rejecting the file.

## Exit check

You may continue when all of these are true:

- [ ] You can list what a checkpoint contains without opening one.
- [ ] You can explain why a checkpoint is useless without compatible model code.
- [ ] You have loaded a checkpoint manually and chatted with it.
- [ ] You can trace one model back to the dataset and settings that produced it.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Unknown checkpoint_id` | Wrong id, or the file was deleted | Re-read `GET /checkpoints`; `models/checkpoints/` is git-ignored |
| Loading fails with a shape mismatch | The model config changed since the file was written | Load with the config stored in the checkpoint, not the current default |
| `/models` does not show the loaded model | The load call targeted a different `model_id` | Pass `model_id` explicitly in `POST /models/load` |
| The checkpoint list is empty | No training has run in this clone | Run Stage 04 first |

## Code map

| What | Where |
| --- | --- |
| `save_checkpoint`, `load_checkpoint`, `list_checkpoints`, `checkpoint_metadata` | [`checkpoints.py`](../../packages/llm_core/llm_core/checkpoints.py) |
| Version metadata construction | `_build_version_metadata` in the same file |
| `GET /checkpoints`, `POST /models/load` | [`apps/api/main.py`](../../apps/api/main.py) |
| Where files land | `models/checkpoints/` (git-ignored) |

## Next stage

[**Stage 08 · Pretrained GPT-2**](08-pretrained-gpt2.md) — you have hit the ceiling of what a
136k-parameter model can learn on your hardware. Time to borrow someone else's.
