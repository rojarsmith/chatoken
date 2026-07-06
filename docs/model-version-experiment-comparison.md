# Model Versions and Experiment Comparison

[English](model-version-experiment-comparison.md) | [繁體中文](model-version-experiment-comparison.zh-TW.md)

This stage makes saved models easier to trace and training runs easier to
compare. A checkpoint is still a full independent model snapshot, but it now
also exposes version metadata that explains where it came from and which
training settings produced it.

## What Was Added

- Checkpoint metadata now includes `version_id`, `version_label`, lineage,
  training config, and metric summary.
- Loaded checkpoint responses include version metadata.
- Experiment logs store the model version that each training job produced.
- Experiments view shows a comparison summary before the two detailed columns.
- Checkpoints view now behaves as a model version catalog.
- API endpoint: `GET /training/experiments/compare`.

## Version Metadata

Each new checkpoint includes:

```text
version_id
version_label
lineage.parent_model_id
lineage.model_id
run_config.dataset_id
run_config.max_steps
run_config.learning_rate
metrics.final_loss
metrics.tokens_seen
```

Older checkpoints can still be listed and loaded. When a checkpoint does not
already contain explicit version metadata, the API derives a fallback version
from the existing payload.

## API Smoke Test

Use Windows Command Prompt with `.venv` activated and the API running:

```cmd
curl -s http://127.0.0.1:8000/checkpoints
curl -s http://127.0.0.1:8000/training/experiments
```

Compare two experiment ids:

```cmd
curl -s "http://127.0.0.1:8000/training/experiments/compare?left_id=LEFT_EXPERIMENT_ID&right_id=RIGHT_EXPERIMENT_ID"
```

## Web UI Learning Flow

1. Run at least two training jobs.
2. Open Experiments.
3. Select a left and right experiment.
4. Read the comparison summary first: prompt, dataset, base model, objective,
   and tuning method should be checked before reading the loss delta.
5. Open Checkpoints.
6. Inspect the model version label, parent model, dataset, objective, loss, and
   training settings.
7. Load the checkpoint version you want to compare in Chat.

## Learning Point

Model output comparison is only meaningful when the run context is visible.
This stage teaches developers to ask:

```text
same prompt?
same base model?
same dataset?
same objective?
same tuning method?
which checkpoint version?
```

Loss and generated text are useful, but they are not enough without model
version and experiment context.
