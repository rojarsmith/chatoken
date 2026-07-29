# Stage 05 · Training knobs

[English](05-training-knobs.md) | [繁體中文](05-training-knobs.zh-TW.md)

**Part 2 · Train** — 17 個階段中的第 5 個 · [課程索引](../README.zh-TW.md)

## Focus

超參數改變的是訓練迴圈，不是架構。

## Prerequisites

- **Stage 04 · Training loop** — 你已用預設值跑過一次訓練，並看著 loss 下降。

## Concept

本階段 `GPTModel` 完全不變。以下每一個旋鈕都屬於 `TrainingConfig`，它控制的是資料如何餵給模型、
以及每次修正有多大。

| 旋鈕 | 預設 | 改變什麼 |
| --- | --- | --- |
| `max_steps` | 80 | 執行幾次最佳化更新。越多次擬合機會越多。 |
| `batch_size` | 4 | 每次更新使用幾個視窗。越大梯度越平滑，記憶體越吃。 |
| `block_size` | 32 | token 視窗長度。越長學到的上下文越長，記憶體越吃。 |
| `stride` | 1 | 視窗在文字上移動的距離。越小重疊越多。 |
| `learning_rate` | 3e-3 | 步伐大小。這是穩定度旋鈕。 |
| `eval_every` | 10 | 只影響記錄頻率，不影響模型。 |
| `sample_prompt` | `Every effort moves you` | 訓練前後比較用的固定 prompt。 |
| `sample_tokens` | 24 | 該比較樣本的長度。 |
| `prompt_style` | `chat` | 樣本 prompt 的包裝方式。 |
| `seed` | 123 | 初始化與洗牌的可重現性。 |

有三個關係值得記在腦子裡：

**每步 token 數 = `batch_size × block_size`。** 預設值下是每次更新 128 個 token。乘上
`max_steps` 再跟資料集大小比較，就知道模型把同一份文字讀了幾遍。

**視窗數量 = `(len(token_ids) - block_size) / stride`。** 這是資料集能產生多少個不同的訓練樣本。
在小資料集上把 `block_size` 調大，樣本數會崩掉——這就是 `every-effort` 會噴
`Training text is too short for block_size=N` 的原因。

**`block_size` 不能超過 `context_length`。** tiny 模型的 position 表只有 64 格，所以 64 是硬上限，
不是偏好設定。

唯一與其他旋鈕性質不同的是 `learning_rate`。其他旋鈕在「速度」與「記憶體」之間取捨；learning rate
則在「速度」與「*穩定度*」之間取捨：太高會震盪或變成 `nan`，太低則幾乎不動。它是唯一能直接毀掉
一次訓練的旋鈕。

## Run it

一次只改一個旋鈕，其餘保持預設，並記錄每次的最終 loss。

### 步數——時間多一點有用嗎？

```cmd
python scripts\smoke_train.py --max-steps 20 --eval-every 5
python scripts\smoke_train.py --max-steps 200 --eval-every 20
```

### Learning rate——穩定度旋鈕

```cmd
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --learning-rate 0.05
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --learning-rate 0.00003
```

### 視窗大小——每個樣本帶多少上下文

```cmd
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --block-size 16
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --block-size 64
```

### Batch size——每次修正有多平滑

```cmd
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --batch-size 1
python scripts\smoke_train.py --max-steps 80 --eval-every 10 --batch-size 8
```

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 05 · Training knobs**。

## What to observe

1. **`max_steps` 移動的是終點線，不是斜率。** 20 步只是在同一條曲線上提早停；200 步則在沒東西
   可學之後趨於平坦。
2. **`learning_rate=0.05` 會出事。** 預期會震盪或出現 `nan`。這是你至少該刻意看過一次的失敗模式。
3. **`learning_rate=0.00003` 在 80 步內幾乎不動 loss**——症狀和「根本沒在訓練」一樣，只是來自
   相反的方向。
4. **`--block-size 64` 會減少這個小檔案能產生的訓練視窗數**，於是每一步重複使用更多相同資料。
5. **`--batch-size 1` 的 loss 曲線比 `--batch-size 8` 更抖**（在相同步數下），同時只看到四分之一
   的 token 量。
6. **`eval_every` 完全不影響結果**——只影響你多久看到一次。自己驗證一遍；這是理解「logging」
   最便宜的方式。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能用 `batch_size` 與 `block_size` 算出每步 token 數。
- [ ] 你已經刻意用高 learning rate 讓一次訓練發散。
- [ ] 你能說明為什麼 `block_size` 有 `context_length` 這個硬上限。
- [ ] 你能指出表格中唯一無法改變訓練結果的那個旋鈕。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `Training text is too short for block_size=N` | 視窗比資料集長 | 調低 `block_size`，或改用 Stage 06 的較大資料集 |
| loss 變成 `nan` | learning rate 太高 | 回到 `3e-3`，再慢慢逼近極限 |
| 兩次相同設定結果不同 | seed 變了，或裝置變了 | `TrainingConfig.seed` 預設 123；保持裝置一致 |
| loss 曲線看起來平坦但樣本變好了 | `eval_every` 太粗，沒抓到下降 | 調低 `eval_every`，它不花成本 |

## Code map

| 內容 | 位置 |
| --- | --- |
| `TrainingConfig` 與上表所有預設值 | [`training.py`](../../packages/llm_core/llm_core/training.py) |
| 由 `block_size` 與 `stride` 構成視窗 | 同檔案的 `TokenDataset.__init__` |
| `DataLoader`、`AdamW` 與步數計數 | 同檔案的 `train_tiny_language_model` |
| 這些旋鈕在伺服器端的範圍限制 | [`training.py`](../../apps/api/schemas/training.py) → `TrainingRequest` |
| CLI 參數 | [`scripts/smoke_train.py`](../../scripts/smoke_train.py) |

## Next stage

[**Stage 06 · Data scale**](06-data-scale.zh-TW.md) — 那個根本不在 `TrainingConfig` 裡、
卻最重要的旋鈕。
