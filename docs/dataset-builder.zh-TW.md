# 訓練資料管理與 Dataset Builder

[English](dataset-builder.md) | [繁體中文](dataset-builder.zh-TW.md)

這個階段要學的是：fine-tuning 的品質不是從 optimizer 開始，而是從資料整理開始。
Web UI 現在有獨立的 Dataset Builder 分頁，開發者可以建立小型 instruction 範例，
把每筆資料指定成 `train` 或 `eval`，再用既有 instruction SFT 流程訓練
`dataset_id=instruction-builder`。

## 新增內容

- 訓練服務新增 `instruction-builder` dataset metadata。
- 本機可編輯 JSON dataset：`data/custom/instruction-builder.json`。
- API 支援讀取、補種子資料、新增、修改、刪除範例。
- Web UI 新增 Dataset Builder 分頁，顯示 train/eval 數量並可編輯範例。
- 訓練整合時只使用 `split=train` 的範例。

`data/custom/` 會被 git 忽略，因為這是本機實驗資料。

## 資料格式

每筆 builder example 會存成一個 JSON object：

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

目前訓練行為：

- `train` 範例會更新模型。
- `eval` 範例會保存下來，供檢視與後續評估功能使用。
- prompt 格式仍沿用 Chapter 7 的 instruction template。

## API Smoke Test

請使用 Windows Command Prompt，並先啟用 `.venv`、啟動 API：

```cmd
curl -s http://127.0.0.1:8000/training/dataset-builder
```

新增一筆 train example：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/dataset-builder/examples ^
  -H "Content-Type: application/json" ^
  -d "{\"split\":\"train\",\"instruction\":\"Explain loss in one sentence.\",\"input\":\"\",\"output\":\"Loss measures how far the model prediction is from the target token.\"}"
```

用自建資料訓練：

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/training/jobs -H "Content-Type: application/json" -d "{\"dataset_id\":\"instruction-builder\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-builder-finetuned\",\"max_steps\":20,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.00005,\"eval_every\":5,\"load_when_complete\":true}" ^| python -c "import sys,json; print(json.load(sys.stdin)['job_id'])"') do set TRAINING_JOB_ID=%i

curl -s "http://127.0.0.1:8000/training/jobs/%TRAINING_JOB_ID%"
```

## Web UI 學習流程

1. 在 GPT-2 分頁載入 GPT-2 small。
2. 打開 Dataset Builder。
3. 檢視種子資料與 `train` / `eval` 數量。
4. 新增一筆 `train` 範例與一筆 `eval` 範例。
5. 在 Builder 下方的訓練面板開始訓練。
6. 比較 `Before (GPT-2 base)` 與 `After (custom SFT)`。
7. 打開 Experiments，確認 `dataset_id=instruction-builder`。

## 學習重點

Dataset Builder 讓資料管線變得明確：

```text
instruction example -> train/eval split -> prompt template -> SFT training loop -> checkpoint
```

資料存在 JSON 裡，不代表模型就會學到它。
只有訓練讀取器選中的範例，才會真的變成 optimizer update。
