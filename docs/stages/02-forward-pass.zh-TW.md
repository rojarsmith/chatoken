# Stage 02 · Forward pass

[English](02-forward-pass.md) | [繁體中文](02-forward-pass.zh-TW.md)

**Part 1 · Generate** — 17 個階段中的第 2 個 · [課程索引](../README.zh-TW.md)

## Focus

id 變成向量，向量流過 block，出來的是詞彙表中每一項各一個分數。

## Prerequisites

- **Stage 01 · Tokens** — 你能把文字變成 id 再變回來，也知道 `vocab_size` 為什麼是 257。

## Concept

`GPTModel` 不是對外部 GPT 函式庫的一次呼叫。它是由本專案的六個本地類別組裝而成：
`MultiHeadAttention`、`GELU`、`FeedForward`、`LayerNorm`、`TransformerBlock`、`GPTModel`。
PyTorch 提供張量、autograd 與 `nn.Module`——架構是你自己的。

**建構順序**，對應 `GPTModel.forward` 由上而下：

```
token ids                       [batch, seq_len]
  -> token embedding      +
     position embedding         [batch, seq_len, emb_dim]
  -> dropout
  -> TransformerBlock × n_layers
  -> final LayerNorm
  -> output head (Linear)       [batch, seq_len, vocab_size]
  = logits
```

兩個 embedding 是「相加」，不是「串接」。token embedding 說的是這個 token *是什麼*；
position embedding 說的是它*在哪裡*。注意力機制本身沒有順序概念——把 position embedding 拿掉，
句子就退化成一袋 token。

**單一 TransformerBlock 內部**是 pre-norm 加上兩條殘差路徑：

```
x -> LayerNorm -> attention    -> dropout -> + x
  -> LayerNorm -> feed-forward -> dropout -> + x
```

每一次殘差相加都替梯度留下一條回到輸入的捷徑，這正是深層堆疊能被訓練的原因。

**注意力內部**依序是：把 `x` 投影成 query、key、value；讓每個 query 對每個 key 打分；套上因果
遮罩，使位置 *i* 永遠看不到位置 *i+1*；除以 `sqrt(head_dim)` 後做 softmax；用權重加權 value；
最後再投影回去。

那個遮罩正是這東西之所以是*語言*模型、而不是文字自編碼器的原因——它是一個
`triu(..., diagonal=1)` 緩衝區，在 softmax 之前把未來位置設成 `-inf`。

輸出是 **logits**，不是機率、也不是文字：在*每一個*位置上，詞彙表每一項各一個原始分數。
生成時只會用到最後一個位置。

## Run it

### 從指令列

建立模型，把四個 token id 推過去：

```cmd
python -c "import torch; from llm_core.configs import MODEL_CONFIGS; from llm_core.model import GPTModel, count_parameters; cfg = MODEL_CONFIGS['random-tiny-byte']; m = GPTModel(cfg.to_dict()); x = torch.tensor([[85, 115, 101, 114]]); print('parameters', count_parameters(m)); print('logits', tuple(m(x).shape))"
```

執行完整的 smoke test，它會回報相同的參數量：

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24
```

### 在控制台

> 階段階梯會在重整的 Phase 2 出現。在那之前，相同內容位於 legacy 頁籤 **GPT Model**。

## What to observe

1. **`parameters 136704`。** 整個模型比一張照片還小。Stage 08 會載入一個大約 900 倍的模型，
   而這份程式碼一行都不用改。
2. **`logits (1, 4, 257)`** — batch 為 1、四個輸入位置、每個位置 257 個分數。最後一維就是
   Stage 01 的 `vocab_size`；輸出頭的寬度就等於 tokenizer 的詞彙量。
3. **每個位置都有分數，不只最後一個。** 這正是 Stage 04 訓練得以高效的原因：一次 forward
   就同時產生所有位置的預測。
4. **序列長度有上限。** 傳入超過 `context_length`（64）個 id，`forward` 會丟出例外。
   這個上限就是 `pos_emb` 表的大小，從 Stage 06 起會不斷出現。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能依序列出 `GPTModel.forward` 的六個階段。
- [ ] 你能說明 token 與 position embedding 為什麼是相加。
- [ ] 你能說明注意力為什麼需要因果遮罩。
- [ ] 你知道 logit 是什麼，以及每個位置為什麼有 257 個。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `Sequence length N exceeds context length 64` | id 數量超過 position 表 | 縮短輸入，或改用 `context_length` 更大的模型 |
| `d_out must be divisible by num_heads` | 自訂設定中 `emb_dim` 與 `n_heads` 不相容 | 保持 `emb_dim % n_heads == 0` |
| 參數量不是 136,704 | 模型設定被改過 | 對照 `MODEL_CONFIGS["random-tiny-byte"]` |

## Code map

| 內容 | 位置 |
| --- | --- |
| `GPTModel`、`TransformerBlock`、`LayerNorm`、`FeedForward`、`GELU` | [`model.py`](../../packages/llm_core/llm_core/model.py) |
| 因果遮罩與注意力順序 | 同檔案的 `MultiHeadAttention.forward` |
| `count_parameters` | 同檔案結尾 |
| tiny 模型設定 | [`configs.py`](../../packages/llm_core/llm_core/configs.py) → `random-tiny-byte` |
| CLI 進入點 | [`scripts/smoke_chat.py`](../../scripts/smoke_chat.py) |

## Next stage

[**Stage 03 · Decoding**](03-decoding.zh-TW.md) — 把那一列 257 個分數變成真正的下一個 token，
以及決定怎麼變的兩個旋鈕。
