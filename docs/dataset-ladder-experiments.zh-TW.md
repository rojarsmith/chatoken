# 資料規模階梯與訓練實驗記錄

[English](dataset-ladder-experiments.md) | [繁體中文](dataset-ladder-experiments.zh-TW.md)

這份文件說明 LLM ABC 的 dataset 與 experiment loop：

```text
選 dataset -> 選 base model -> train -> save checkpoint -> record experiment -> compare
```

重要分線是：資料規模訓練和 instruction following 是兩個不同學習目標。

- `the-verdict` 是較大的 raw text dataset，用來做 next-token pretraining。
- `instruction-following` 是 instruction/response dataset，用來做 GPT-2 instruction SFT。

## Dataset Ladder

- `every-effort`：第一個 overfit 實驗用的 tiny chat-shaped text。
- `every-effort-expanded`：更多變化的小型 phrase ladder。
- `learning-dialogues`：中型 chat-shaped 教學資料。
- `the-verdict`：下載到 `data/external/the-verdict.txt` 的較大 raw text。
- `instruction-following`：Chapter 7 instruction data，下載到 `data/external/instruction-data.json`。

查詢 dataset metadata：

```cmd
curl -s http://127.0.0.1:8000/training/datasets
```

## 用 The Verdict 做 Raw Text Training

The Verdict 預設應搭配從零開始的 tiny model，除非你是刻意做延伸實驗：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"the-verdict\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-verdict-byte\",\"max_steps\":320,\"eval_every\":40,\"batch_size\":4,\"block_size\":64,\"learning_rate\":0.003,\"sample_prompt\":\"I had always thought Jack Gisburn\",\"load_when_complete\":true}"
```

這會記錄一個實驗：模型在較大的文字檔上學 raw continuation 行為。

## 用 GPT-2 做 Instruction SFT

先載入 GPT-2：

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/pretrained/jobs -H "Content-Type: application/json" -d "{\"model_size\":\"124M\",\"model_id\":\"gpt2-124M\"}" ^| python -c "import sys,json; print(json.load(sys.stdin)['job_id'])"') do set GPT2_JOB_ID=%i
```

再使用 instruction dataset：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-following\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-instruct-finetuned\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.00005,\"sample_prompt\":\"Explain what a model checkpoint is in one sentence.\",\"load_when_complete\":true}"
```

這個實驗才是用來比較 raw pretrained GPT-2 和 instruction-tuned GPT-2 的差異。

## Prompt Roles

- `comparison_prompt`：before/after sample 使用的 prompt。
- `dataset_probe_prompt`：用來檢查 dataset-specific behavior 的代表 prompt 或片語。
- `prompt_style`：後端在 tokenization 前如何包裝 prompt。

Prompt styles：

- `chat`：tiny chat-shaped dataset 使用 `User: ... Assistant:`。
- `raw`：The Verdict 使用純文字續寫。
- `instruction`：GPT-2 使用 Chapter 7 instruction template。

## Before 代表什麼

`Before (base)` 是目前 training job 更新權重之前，由所選 `base_model_id` 產生的輸出。

- 對 `random-tiny-byte` 來說，它是隨機初始化 tiny model。
- 對 `gpt2-124M` 來說，它是套用 instruction prompt formatting 的 downloaded pretrained GPT-2。
- 對 checkpoint 來說，它是下一次 training run 之前的 checkpoint 行為。

## Experiment Records

每筆紀錄會存 dataset ID、training objective、prompt style、base model、output model、loss snapshots、tokens seen、before/after samples 與 checkpoint ID。

checkpoint 儲存的是完整 `model.state_dict()`，不是差異檔。
