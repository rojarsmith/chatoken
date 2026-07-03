# Training Data Management and Dataset Builder

[English](dataset-builder.md) | [繁體中文](dataset-builder.zh-TW.md)

This stage teaches that fine-tuning quality starts before the optimizer runs.
The Web UI now has a Dataset Builder view where developers can create small
instruction examples, assign each example to `train` or `eval`, and then run the
existing instruction SFT loop with `dataset_id=instruction-builder`.

## What Was Added

- `instruction-builder` dataset metadata in the training service.
- A local editable JSON dataset at `data/custom/instruction-builder.json`.
- API endpoints for reading, seeding, adding, updating, and deleting examples.
- A Web UI Dataset Builder tab with train/eval counts and editable examples.
- Training integration that uses only `split=train` examples.

`data/custom/` is ignored by git because it is local experiment data.

## Data Format

Each builder example is stored as one JSON object:

```json
{
  "example_id": "generated-id",
  "split": "train",
  "instruction": "Explain what a model checkpoint is in one sentence.",
  "input": "",
  "output": "A model checkpoint is a saved snapshot of model weights and metadata.",
  "created_at": "2026-07-03T00:00:00+00:00",
  "updated_at": "2026-07-03T00:00:00+00:00"
}
```

Current training behavior:

- `train` examples update the model.
- `eval` examples are saved for inspection and future evaluation work.
- The prompt format still follows the Chapter 7 instruction template.

## API Smoke Test

Use Windows Command Prompt with `.venv` activated and the API running:

```cmd
curl -s http://127.0.0.1:8000/training/dataset-builder
```

Add a train example:

```cmd
curl -s -X POST http://127.0.0.1:8000/training/dataset-builder/examples ^
  -H "Content-Type: application/json" ^
  -d "{\"split\":\"train\",\"instruction\":\"Explain loss in one sentence.\",\"input\":\"\",\"output\":\"Loss measures how far the model prediction is from the target token.\"}"
```

Train with the custom dataset:

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/training/jobs -H "Content-Type: application/json" -d "{\"dataset_id\":\"instruction-builder\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-builder-finetuned\",\"max_steps\":20,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.00005,\"eval_every\":5,\"load_when_complete\":true}" ^| python -c "import sys,json; print(json.load(sys.stdin)['job_id'])"') do set TRAINING_JOB_ID=%i

curl -s "http://127.0.0.1:8000/training/jobs/%TRAINING_JOB_ID%"
```

## Web UI Learning Flow

1. Load GPT-2 small in the GPT-2 tab.
2. Open Dataset Builder.
3. Inspect the seeded examples and the `train` / `eval` counts.
4. Add one new `train` example and one new `eval` example.
5. Start training in the panel below the builder.
6. Compare `Before (GPT-2 base)` with `After (custom SFT)`.
7. Open Experiments and confirm `dataset_id=instruction-builder`.

## Learning Point

The builder makes the data pipeline explicit:

```text
instruction example -> train/eval split -> prompt template -> SFT training loop -> checkpoint
```

The model does not learn from examples merely because they exist in a JSON file.
Only examples selected by the training reader become optimizer updates.
