# Stage 11 · LoRA

[English](11-lora.md) | [繁體中文](11-lora.zh-TW.md)

**Part 4 · Align** — 17 個階段中的第 11 個 · [課程索引](../README.zh-TW.md)

## Focus

同樣的行為改變，但只訓練約百分之一的參數。

## Prerequisites

- **Stage 10 · Instruction SFT** — 你已經微調過 GPT-2 全部 1.24 億個權重，也付過那筆記憶體帳單。

## Concept

完整微調會更新每一個權重。LoRA（Low-Rank Adaptation）則凍結原始模型，改成在被選中的層旁邊
訓練一對很小的矩陣。

對一個形狀 `[out, in]` 的凍結線性層 `W`，LoRA 加上兩個小得多的矩陣：形狀 `[rank, in]` 的 `A`
與形狀 `[out, rank]` 的 `B`：

```
output = W·x  +  (B · A · x) × (alpha / rank)
         ^^^     ^^^^^^^^^^^
         凍結     可訓練
```

在 GPT-2 寬度 768 的注意力投影上取 `rank=8`，`A` 與 `B` 合計約
`8 × 768 × 2 = 12,288` 個數字，而 `W` 有 `768 × 768 = 589,824` 個。這就是全部的節省，
在每個被選中的層上重複一次。

`LoRAConfig` 的預設值：

| 欄位 | 預設 | 意義 |
| --- | --- | --- |
| `rank` | 8 | 瓶頸寬度。越高能擬合越多，成本也越高。 |
| `alpha` | 16 | 縮放分子；實際縮放為 `alpha / rank` = 2。 |
| `dropout` | 0.05 | 只作用在 adapter 輸入路徑上的 dropout。 |
| `target_modules` | `("W_query", "W_value")` | 哪些層會掛上 adapter。 |

只有 query 與 value 被適配，key 與前饋網路都沒有。這是常見選擇，而且值得注意它是一個
*選擇*——一個你可以改的選擇。

有個細節值得留意：**`lora_b` 初始化為全零**，而 `lora_a` 使用 Kaiming 初始化。因此在第 0 步時
乘積 `B·A` 恰好為零，適配後的模型在數值上與凍結的 base 完全相同。訓練是從 GPT-2 出發，
而不是從雜訊出發——這正是 LoRA 能安全地掛到一個能用的模型上的原因。

流程：

```
載入 GPT-2 base
  -> 凍結每一個參數
  -> 把 W_query 與 W_value 換成包了 LoRA 的線性層
  -> 只訓練 A/B 矩陣
  -> 合併：W_merged = W + (B·A) × scaling
  -> 存成一般的完整 checkpoint
```

合併這一步正是 Stage 07 的載入器仍然可用的原因。存下來的產出物是普通的完整 checkpoint，
不需要支援任何 adapter 格式。你用「執行期切換 adapter 的能力」換到「系統簡單得多」——
對教學專案而言這是合理的取捨，而且是明確做出的取捨。

## Run it

### 準備資料集

```cmd
curl -s -X POST http://127.0.0.1:8000/training/datasets/instruction-lora/prepare
```

### 訓練 adapter

注意 learning rate：`3e-4`，是 Stage 10 的 `5e-5` 的六倍。

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-lora\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-instruct-lora\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.0003,\"sample_prompt\":\"Explain what a model checkpoint is in one sentence.\",\"load_when_complete\":true}"
```

### 用同一個 prompt 與 Stage 10 比較

```cmd
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-instruct-finetuned\",\"max_new_tokens\":80,\"inference_mode\":\"focused\"}"
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-instruct-lora\",\"max_new_tokens\":80,\"inference_mode\":\"focused\"}"
```

### 在控制台

> 階段階梯會在重整的 Phase 2 出現。在那之前，這位於 legacy 頁籤 **LoRA**。

## What to observe

1. **`trainable_percent` 是重點。** 訓練摘要會回報 `trainable_parameters`、`total_parameters`
   與兩者比例。拿去跟 Stage 10 比——那裡的比例是 100%。
2. **輸出品質大致相當。** 參數量差距極大，行為改變卻相近——這正是 LoRA 的主張，
   而你可以在這裡親自檢驗。
3. **learning rate 高了六倍。** 由更少的參數承擔全部調整，所以每個參數要移動得更遠。
   在這裡沿用 `5e-5` 幾乎什麼也不會發生。
4. **記憶體用量下降。** 梯度與 AdamW 狀態只存在於 adapter。凍結的權重在 forward 時仍佔記憶體
   ——這降低的是訓練成本，不是模型大小。
5. **存下的 checkpoint 看起來完全普通。** `GET /checkpoints` 顯示的是完整快照；
   只有 `tuning_method: lora` 透露它的來歷。
6. **在 CPU 上依然很慢。** 可訓練參數變少，但每一步仍要跑完整的 GPT-2 forward 與 backward。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能說明 `rank` 控制什麼，以及 `alpha / rank` 為何出現在 forward 中。
- [ ] 你能說明把 `lora_b` 初始化為零為什麼重要。
- [ ] 你能指出 GPT-2 中哪些層掛了 adapter、哪些沒有。
- [ ] 你能說明為什麼存下的 checkpoint 不需要 adapter 載入器。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `Training has no trainable parameters` | 全部凍結卻沒掛上 adapter | 確認 `target_modules` 對應真實層名（`W_query`、`W_value`） |
| loss 幾乎不動 | 沿用了完整 SFT 的 learning rate | 用 `3e-4`，不是 `5e-5` |
| 看不到記憶體節省 | 凍結權重在 forward 時仍需記憶體 | 預期行為——節省的是梯度與最佳化器狀態 |
| 輸出與 base GPT-2 完全相同 | 步數太少，或合併沒有執行 | 檢查任務摘要中的 `tuning_method` 與 `trainable_parameters` |

## Code map

| 內容 | 位置 |
| --- | --- |
| `LoRAConfig`、`LoRALinear`、`apply_lora`、`merge_lora` | [`lora.py`](../../packages/llm_core/llm_core/lora.py) |
| `lora_b` 零初始化、`lora_a` Kaiming 初始化 | 同檔案的 `LoRALinear.__init__` |
| 合併運算 | 同檔案的 `LoRALinear.merged_linear` |
| 資料集規格與建議設定 | [`training_service.py`](../../apps/api/services/training_service.py) → `instruction-lora` |

## Next stage

[**Stage 12 · Chat SFT**](12-chat-sft.zh-TW.md) — 同樣的 adapter 技巧指向多輪逐字稿，
外加一個關於「loss 該涵蓋哪些 token」的新觀念。
