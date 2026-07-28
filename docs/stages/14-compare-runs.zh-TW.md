# Stage 14 · Compare runs

[English](14-compare-runs.md) | [繁體中文](14-compare-runs.zh-TW.md)

**Part 4 · Align** — 17 個階段中的第 14 個 · [課程索引](../README.zh-TW.md)

## Focus

只比較可比較的東西。

## Prerequisites

- **Stage 13 · Your own dataset** — 你已經累積至少五次訓練，橫跨不同資料集、base model
  與微調方法。

## Concept

你現在有一堆 checkpoint，以及一個很自然的問題：哪一個最好？答案通常是
「這個問題目前還沒被問清楚」。

單一 loss 數字本身沒有意義。在 `every-effort` 上的執行會逼近零 loss，卻毫無價值；
在 `the-verdict` 上的執行停在高得多的數字，卻學到多得多。loss 只有在固定的設定**之內**才可比較。

所以在比較兩次執行之前，有五件事必須一致：

```
同一個 prompt？
同一個資料集？
同一個 base model？
同一個訓練目標？
同一種微調方法？
```

`GET /training/experiments/compare` 檢查的正是這五項，並在任何指標之前先回傳一個 `same` 區塊
——`prompt`、`dataset`、`baseModel`、`objective`、`tuning`。當某個欄位是 `false`，
回應會附上說明，指出這個不一致讓什麼失效。

本階段教的是一個操作順序：

1. 讀一致性摘要。
2. 讀設定差異。
3. *然後*才讀 loss 差距。
4. *然後*才讀生成樣本。

把順序反過來，就是人們說服自己相信錯誤結論的方式。生成文字是所有證據中最有說服力、
也最不可靠的一種——流暢很容易被讀成正確，而你也很容易偏袒你原本期待會贏的那個樣本。

每一次訓練都會在 `models/experiments/training-experiments.jsonl` 追加一筆紀錄：
資料集 id、訓練目標、prompt style、base model、輸出模型、loss 快照、tokens seen、
訓練前後樣本、微調方法與 checkpoint id。這份紀錄讓事後比較成為可能，不必重跑任何東西。

## Run it

### 列出所有執行

```cmd
curl -s http://127.0.0.1:8000/training/experiments
```

### 一次公平的比較——同資料集、不同微調方法

Stage 10（完整 SFT）對上 Stage 11（LoRA）：同一個資料集家族、同一個 base、同一個 prompt。

```cmd
curl -s "http://127.0.0.1:8000/training/experiments/compare?left_id=<FULL_SFT_ID>&right_id=<LORA_ID>"
```

### 一次不公平的比較——刻意跑一次

Part 2 的 tiny 模型執行對上 Part 4 的 GPT-2 執行：

```cmd
curl -s "http://127.0.0.1:8000/training/experiments/compare?left_id=<EVERY_EFFORT_ID>&right_id=<CHAT_SFT_ID>"
```

讀 `same` 區塊與說明。這一次呼叫的教育價值比上一次更高。

### 與 checkpoints 交叉檢查

```cmd
curl -s http://127.0.0.1:8000/checkpoints
```

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 14 · Compare runs**。

## What to observe

1. **摘要刻意排在最前面。** API 先回傳一致性、後回傳指標，因為在一致性被檢查之前，
   指標沒有意義。
2. **不公平的比較會回報多個 `false` 欄位**，每個都附說明。在這裡「loss 比較低」證明不了任何事。
3. **完整 SFT 與 LoRA 在輸出上相近，在 `trainable_percent` 上相差極遠。** 這是整個課程中
   唯一一次在其他條件都固定的情況下，看得見真正的取捨。
4. **`tuning_method` 在 LoRA 之前的紀錄中預設為 `full`**，所以舊紀錄仍然可以乾淨地比較。
5. **資料集階梯上的 `final_loss` 不是排行榜。** 把 Stage 06 的四次執行排在一起，
   確認最低的 loss 屬於最沒用的模型。
6. **訓練前後樣本使用同一個 `comparison_prompt`**（對特定資料集而言）——這正是資料集規格中
   有這個欄位的原因。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能列出比較有意義前必須一致的五個欄位。
- [ ] 你已經刻意執行過一次無效的比較並讀過說明。
- [ ] 你能說明為什麼實驗紀錄中最低的 loss 不是最好的模型。
- [ ] 你每次都先讀摘要與設定，再讀樣本。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 實驗清單是空的 | 這份 clone 還沒訓練過 | `models/experiments/` 被 git 忽略；先做 Stage 04 |
| `Unknown experiment id` | id 錯誤 | 從 `GET /training/experiments` 複製 id |
| `same` 全部是 `false` | 兩次執行完全無關 | 預期行為；挑共用資料集與 base model 的執行 |
| loss 差距看起來不合理 | 目標不同——raw-text 對 instruction | 跨目標的 loss 根本不可比較 |

## Code map

| 內容 | 位置 |
| --- | --- |
| 實驗紀錄寫入 | [`training_service.py`](../../apps/api/services/training_service.py) |
| 一致性計算與說明 | 同檔案的 `compare_experiments` / `_build_comparison` |
| `GET /training/experiments`、`GET /training/experiments/compare` | [`apps/api/main.py`](../../apps/api/main.py) |
| 實驗紀錄檔 | `models/experiments/training-experiments.jsonl`（被 git 忽略） |

## Next stage

[**Stage 15 · Conversation memory**](15-conversation-memory.zh-TW.md) — Part 5 開始。
模型做完了，但它周圍的系統還沒有。
