# 模型版本與實驗比較強化

[English](model-version-experiment-comparison.md) | [繁體中文](model-version-experiment-comparison.zh-TW.md)

這個階段讓已保存的模型更容易追溯，也讓訓練實驗更容易比較。
checkpoint 仍然是一份完整、可獨立載入的模型快照，但現在會額外暴露版本資訊，
說明它從哪個 base model 來、用了哪些訓練設定、產生了哪些指標。

## 新增內容

- checkpoint metadata 新增 `version_id`、`version_label`、lineage、training config、metrics summary。
- 載入 checkpoint 的 API response 會回傳版本資訊。
- experiment log 會保存每次訓練產生的 model version。
- Experiments view 在左右詳細欄位之前新增 comparison summary。
- Checkpoints view 改成模型版本目錄，顯示 lineage 與訓練設定。
- API endpoint：`GET /training/experiments/compare`。

## Version Metadata

每個新 checkpoint 會包含：

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

舊 checkpoint 仍然可以列出與載入。
如果舊 checkpoint 裡沒有明確版本資訊，API 會根據既有 payload 產生 fallback version。

## API Smoke Test

請使用 Windows Command Prompt，並先啟用 `.venv`、啟動 API：

```cmd
curl -s http://127.0.0.1:8000/checkpoints
curl -s http://127.0.0.1:8000/training/experiments
```

比較兩個 experiment id：

```cmd
curl -s "http://127.0.0.1:8000/training/experiments/compare?left_id=LEFT_EXPERIMENT_ID&right_id=RIGHT_EXPERIMENT_ID"
```

## Web UI 學習流程

1. 先執行至少兩次訓練。
2. 打開 Experiments。
3. 選擇 left 與 right experiment。
4. 先讀 comparison summary：prompt、dataset、base model、objective、tuning method 是否相同。
5. 再看 loss delta 與 tokens/steps 等差值。
6. 打開 Checkpoints。
7. 檢視 model version label、parent model、dataset、objective、loss、training settings。
8. 載入你要比較的 checkpoint version，再回 Chat 測試。

## 學習重點

模型輸出比較只有在 run context 清楚時才有意義。
這個階段要讓開發者養成先問以下問題：

```text
same prompt?
same base model?
same dataset?
same objective?
same tuning method?
which checkpoint version?
```

Loss 和 generated text 很有用，但如果沒有模型版本與實驗上下文，就很容易比較錯東西。
