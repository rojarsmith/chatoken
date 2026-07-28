# Stage 13 · Your own dataset

[English](13-your-own-dataset.md) | [繁體中文](13-your-own-dataset.zh-TW.md)

**Part 4 · Align** — 17 個階段中的第 13 個 · [課程索引](../README.zh-TW.md)

## Focus

你的資料才是產品。微調品質在最佳化器啟動之前就已經決定。

## Prerequisites

- **Stage 12 · Chat SFT** — 你已經在三份別人寫好的資料集上跑過微調。

## Concept

到目前為止每個資料集都是現成的。真實工作中不會這樣：資料才是你擁有的部分，
也是品質的主要來源。

Dataset Builder 把可編輯的範例存在 `data/custom/instruction-builder.json`，每筆一個 JSON 物件：

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

新觀念在 `split` 這個欄位。標記為 `train` 的範例會變成最佳化更新；標記為 `eval` 的會被保存，
但永遠不參與訓練。

這個切分不是行政流程。看過某個範例的模型當然能重現它，而那完全無法說明它是否學到任何通則。
被保留的範例是唯一能回答這個問題的資料——而且只有在你*看結果之前*就先保留，它才有效。

在目前的實作中，`eval` 範例是保存下來供檢視，而不是自動評分。這是一個誠實的限制，
而且在這裡明說而非隱藏：切分機制存在，紀律要靠你自己。

本階段讓這條管線變得可見：

```
instruction 範例 -> train/eval 切分 -> prompt 樣板 -> SFT 迴圈 -> checkpoint
```

範例不會因為存在於檔案裡就教會模型。只有訓練讀取器選中的那些，才會變成梯度更新。

`data/custom/` 被 git 忽略——那是你本機的實驗資料。

## Run it

### 檢視現況

```cmd
curl -s http://127.0.0.1:8000/training/dataset-builder
```

### 還原起始範例

builder 在第一次被讀取時就會**自動 seed**，所以全新 clone 一開始就有三筆範例——你不需要這一步
就能開始。只有在檔案不存在、或你把範例全部刪光時，它才會把起始範例放回去。

```cmd
curl -s -X POST http://127.0.0.1:8000/training/dataset-builder/seed
```

### 加入一個訓練範例與一個保留範例

```cmd
curl -s -X POST http://127.0.0.1:8000/training/dataset-builder/examples ^
  -H "Content-Type: application/json" ^
  -d "{\"split\":\"train\",\"instruction\":\"Explain loss in one sentence.\",\"input\":\"\",\"output\":\"Loss measures how far the model prediction is from the target token.\"}"

curl -s -X POST http://127.0.0.1:8000/training/dataset-builder/examples ^
  -H "Content-Type: application/json" ^
  -d "{\"split\":\"eval\",\"instruction\":\"Explain overfitting in one sentence.\",\"input\":\"\",\"output\":\"Overfitting is when a model memorizes its training data instead of generalizing.\"}"
```

用 `example_id` 編輯或刪除範例：

```cmd
curl -s -X PUT http://127.0.0.1:8000/training/dataset-builder/examples/<EXAMPLE_ID> ^
  -H "Content-Type: application/json" ^
  -d "{\"split\":\"train\",\"instruction\":\"...\",\"input\":\"\",\"output\":\"...\"}"

curl -s -X DELETE http://127.0.0.1:8000/training/dataset-builder/examples/<EXAMPLE_ID>
```

### 用你自己的資料訓練

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-builder\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-builder-finetuned\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.00005,\"load_when_complete\":true}"
```

### 用保留範例檢驗

拿一道模型從未訓練過的 `eval` 指令去問它，然後自己判斷答案。

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 13 · Your own dataset**。

## What to observe

1. **train 與 eval 的數量分開回報。** 只有 `train` 的數量會影響訓練。
2. **加一筆範例就會改變訓練後的模型。** 在這麼小的資料集上，個別範例會直接顯現在輸出中——
   這既有教育意義，也是一個警告。
3. **你的措辭會被繼承。** 輸出寫得簡短，得到的答案就簡短。模型複製風格跟複製內容一樣快。
4. **eval 範例會暴露落差。** 訓練過的指令答得不錯；被保留的那道通常不行。這個差距是你唯一
   誠實的訊號。
5. **`dataset_id: instruction-builder` 會被記錄在實驗紀錄中**，所以 Stage 14 知道這些執行
   不能跟內建資料集相比。
6. **使用的是 Stage 09 的同一個 instruction 樣板。** 你的資料走的是同一條管線；格式沒有任何特別之處。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你已經透過 API 新增、編輯、刪除過範例。
- [ ] 你能說明為什麼 `eval` 範例不能拿去訓練。
- [ ] 你已經用自己的範例訓練過，並測試過一道保留的指令。
- [ ] 你能說明為什麼小資料集會讓每一筆範例的影響力異常大。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| builder 資料集是空的 | 你把範例全部刪光了 | `POST /training/dataset-builder/seed` 會還原起始範例 |
| 訓練因為沒有範例而失敗 | 所有範例都標成 `eval` | 至少要有一筆 `split: train` |
| 修改消失了 | `data/custom/` 被 git 忽略，且被清掉了 | 起始範例會自動回來，你自己加的不會——重要的請自行匯出 |
| 模型回答與之前完全一樣 | 訓練範例太少，或步數太少 | 先加範例，再加步數——這正是本階段的重點 |

## Code map

| 內容 | 位置 |
| --- | --- |
| Builder 儲存、seed、CRUD、train/eval 過濾 | [`training_service.py`](../../apps/api/services/training_service.py) |
| 資料集規格 | 同檔案 → `instruction-builder` |
| `GET/POST /training/dataset-builder`、`POST/PUT/DELETE .../examples` | [`apps/api/main.py`](../../apps/api/main.py) |
| 本機資料檔 | `data/custom/instruction-builder.json`（被 git 忽略） |

## Next stage

[**Stage 14 · Compare runs**](14-compare-runs.zh-TW.md) — 你現在有五個以上的 checkpoint 與
好幾個關於它們的說法。該檢查這些比較站不站得住腳了。
