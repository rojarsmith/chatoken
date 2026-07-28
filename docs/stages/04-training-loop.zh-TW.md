# Stage 04 · Training loop

[English](04-training-loop.md) | [繁體中文](04-training-loop.zh-TW.md)

**Part 2 · Train** — 17 個階段中的第 4 個 · [課程索引](../README.zh-TW.md)

## Focus

loss 就是把資料變成權重的那個訊號。

## Prerequisites

- **Stage 03 · Decoding** — 你已經用 `random-tiny-byte` 產生過文字，也看到調整
  `temperature` 與 `top_k` 只會改變輸出的形狀，永遠改變不了品質。

你即將修好這件事，而這個修法是本課程中第一件真正改變模型本身的事。

## Concept

Part 1 的一切都是推論：權重是隨機的，而且一直維持隨機。訓練則是一個不斷重複四個步驟的迴圈，
直到你叫停為止：

```
  batch ──▶ model ──▶ logits ──▶ cross_entropy(logits, targets) ──▶ loss
                                                                     │
    weights ◀── optimizer.step() ◀── gradients ◀── loss.backward() ◀─┘
```

有三個觀念讓這個迴圈成立。

**1. 訓練訊號是免費的。** 沒有人替這份資料標註。`TokenDataset` 以 `block_size` 為寬度在 token
ids 上滑動視窗，並把每個視窗與*同一個視窗往右移一格*配成一對：

```
ids      = [ 85, 115, 101, 114, 58, 32, 69, ... ]
input    = [ 85, 115, 101, 114, 58, 32 ]
target   = [ 115, 101, 114, 58, 32, 69 ]
```

模型在每個位置的任務都是預測下一個 id，而答案本來就在文字裡——這就是為什麼純文字足以拿來訓練。

**2. loss 衡量的是「驚訝程度」。** `cross_entropy` 把模型的分數分布與唯一正確的 id 做比較。
一個在 257 個 id 上均勻亂猜的模型會得到 `ln(257) ≈ 5.55`。這個數字就是你的基準：在第 1 步，
未訓練的模型應該落在它附近，而每往下掉一點，都是模型原本沒有的知識。

**3. 一個 step 就是一個 batch。** `max_steps=80` 不代表把資料掃 80 遍，而是 80 個各含
`batch_size` 個視窗的 batch。每跑完一個，`AdamW` 就調整一次所有可訓練參數。

本階段使用的資料集 `every-effort` 是同樣兩行重複四次。它本來就該是簡單到不行的。一個把小資料集
背起來的模型就是**過擬合（overfit）**，而過擬合是「學習確實發生了」最便宜的證明。要到 Stage 06，
過擬合才不再是好事。

## Run it

### 從指令列

```cmd
python scripts\smoke_train.py --max-steps 80 --eval-every 10
```

這支腳本會在訓練*前*先產生一個樣本、跑完迴圈、訓練*後*再產生一個樣本，最後存下 checkpoint。

### 透過 API

啟動一個訓練任務：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"every-effort\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-tiny-byte\",\"max_steps\":80,\"eval_every\":10,\"load_when_complete\":true}"
```

用回傳的 `job_id` 輪詢：

```cmd
curl -s "http://127.0.0.1:8000/training/jobs/<JOB_ID>"
```

接著把同一個 prompt 送到 `/chat` 兩次——一次用 `"model_id":"random-tiny-byte"`，
一次用 `"model_id":"trained-tiny-byte"`——然後比較結果。

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 04 · Training loop**。

## What to observe

1. **訓練前的樣本**是逸出位元組——就是 Stage 03 的基準線，這裡再印一次，方便就地比較。
2. **第 1 步的 loss** 接近 `5.55`。此時的模型只是一個昂貴的、在 257 個選項上擲骰子的東西。
3. **loss 掉得又快又深**（80 步之內）。在這麼小的資料集上，它應該會趨近於零，因為幾乎沒有東西
   要學。
4. **`tokens_seen` 每步增加 `batch_size × block_size`**——預設值下是每步 128 個 token。
   拿它跟資料集大小比一比，你就會看到模型把同一份文字讀了很多遍。
5. **訓練後的樣本會出現訓練文字的可辨識片段**——像 `Every`、`forwar`、`Ast:` 這些碎片，
   而不再是隨機位元組。但它*不會*乾淨地重現整句話，即使跑到 800 步、loss 降到 0.09 附近也一樣：
   一個 2 層、64 維、逐位元組處理的模型沒有那個容量。「學會了這個檔案」與「能重現這個檔案」
   是兩種說法，這裡只有前者成立。
6. **會印出一個 checkpoint 路徑。** 那個檔案就是這次執行的全部成果——Stage 07 會講裡面有什麼。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能在不使用「標註」這個詞的前提下說明訓練目標從哪裡來。
- [ ] 你知道使用 byte tokenizer 的未訓練模型 loss 會從哪個數字附近開始，以及為什麼。
- [ ] 你已經比較過同一個 prompt 在訓練前後的輸出。
- [ ] 你能說明為什麼在 `every-effort` 上過擬合是這裡預期中的結果。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `Training text is too short for block_size=N` | `TokenDataset` 需要多於 `block_size` 個 token | 調低 `--block-size`，或改用 Stage 06 的較大資料集 |
| loss 變成 `nan` | learning rate 太高 | 把 `--learning-rate` 調回 `3e-3` 附近 |
| loss 幾乎不動 | 步數太少，或 learning rate 低太多 | 提高 `--max-steps`；這正是 Stage 05 要做的實驗 |
| 訓練後樣本仍然像亂碼 | 任務失敗，或你比較到錯的 `model_id` | 檢查任務的 `status` 與 `error`；確認 `load_when_complete` 是 `true` |

## Code map

| 內容 | 位置 |
| --- | --- |
| `TrainingConfig` 預設值 | [`training.py`](../../packages/llm_core/llm_core/training.py) — `max_steps=80`、`batch_size=4`、`block_size=32`、`learning_rate=3e-3` |
| 視窗配對 | 同檔案的 `TokenDataset.__init__` |
| 訓練迴圈本體 | 同檔案的 `train_tiny_language_model` |
| 寫出 checkpoint | [`checkpoints.py`](../../packages/llm_core/llm_core/checkpoints.py) → `save_checkpoint` |
| CLI 進入點 | [`scripts/smoke_train.py`](../../scripts/smoke_train.py) |
| 資料集註冊項目 | [`training_service.py`](../../apps/api/services/training_service.py) → `every-effort` |
| `POST /training/jobs` | [`apps/api/main.py`](../../apps/api/main.py) |

## Next stage

[**Stage 05 · Training knobs**](05-training-knobs.zh-TW.md) — 同一個迴圈，但一次只動
`max_steps`、`batch_size`、`block_size`、`learning_rate` 其中一個，看清楚哪一個影響速度、
哪一個影響穩定度。
