# 模型基礎原理

[English](model-foundations.md) | [繁體中文](model-foundations.zh-TW.md)

這一階段補上訓練前的缺口：學習者應該先看到本機 GPT model 是如何組裝出來的，再按 `Start` 開始訓練。

Web UI 現在把這些頁面放在 Chat 和 From Scratch 前面：

```text
GPT Model -> Training Config -> Chat -> From Scratch -> Raw Text -> GPT-2 -> Instruction
```

## GPTModel 建立順序

本機模型跟參考專案的教學路徑一致：

```text
Chapter 3: attention
Chapter 4: GPTModel
Chapter 5: training loop
```

實作位置在 `packages/llm_core/llm_core/model.py`：

```text
token ids
-> token embedding
-> position embedding
-> dropout
-> TransformerBlock x n_layers
-> final LayerNorm
-> output head
-> logits
```

重點是 `GPTModel` 不是直接呼叫外部 GPT library。它是由本專案的 class 組裝出來：

- `MultiHeadAttention`
- `GELU`
- `FeedForward`
- `LayerNorm`
- `TransformerBlock`
- `GPTModel`

PyTorch 仍然負責 tensor、矩陣運算、gradient 和 module 基礎設施。這一階段要學的是模型結構與資料流。

## TransformerBlock 建立順序

每個 block 使用 pre-norm residual 結構：

```text
x
-> LayerNorm
-> masked multi-head self-attention
-> dropout
-> residual add
-> LayerNorm
-> feed-forward network
-> dropout
-> residual add
```

這裡要先理解 attention、normalization、feed-forward layer、residual path 是不同概念。

## TrainingConfig 參數

實作位置在 `packages/llm_core/llm_core/training.py`。

重要參數：

- `max_steps`：optimizer 更新次數。越多 steps，模型越有機會 fitting data。
- `batch_size`：每次更新使用幾個訓練視窗。越大越平滑，但越吃記憶體。
- `block_size`：每個訓練視窗的 token 長度。越大越能學長上下文，但計算與記憶體成本越高。
- `stride`：訓練視窗在文字中每次移動多遠。
- `learning_rate`：optimizer 每次更新的步伐大小。
- `eval_every`：多久記錄一次 progress。
- `sample_prompt`：before/after 比較使用的固定 prompt。
- `prompt_style`：chat、raw text 或 instruction formatting。
- `sample_tokens`：比較輸出時產生幾個 token。
- `seed`：控制初始化與 shuffle，讓實驗較可重現。

Web UI 的 `Training Config` 頁會調整同一組訓練表單狀態，並估算 tokens per step、total tokens seen、text windows、loss snapshots。

## 學習檢查點

在執行 From Scratch 訓練前，學習者應該能說明：

1. 為什麼 token embedding 和 position embedding 要相加。
2. 為什麼 attention 需要 causal mask。
3. 為什麼 `block_size` 不能超過 model `context_length`。
4. 為什麼 `learning_rate` 會影響穩定性。
5. 為什麼 loss 下降時，生成文字仍然可能很粗糙。
