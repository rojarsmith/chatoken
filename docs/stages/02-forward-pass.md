# Stage 02 · Forward pass

[English](02-forward-pass.md) | [繁體中文](02-forward-pass.zh-TW.md)

**Part 1 · Generate** — Stage 2 of 17 · [Course index](../README.md)

## Focus

Ids become vectors, vectors flow through blocks, and what comes out is one score per
vocabulary entry.

## Prerequisites

- **Stage 01 · Tokens** — you can turn text into ids and back, and you know why `vocab_size`
  is 257.

## Concept

`GPTModel` is not a call into an external GPT library. It is assembled in this project from
six local classes: `MultiHeadAttention`, `GELU`, `FeedForward`, `LayerNorm`,
`TransformerBlock`, and `GPTModel`. PyTorch supplies tensors, autograd, and `nn.Module` —
the architecture is yours.

**The build order**, top to bottom in `GPTModel.forward`:

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

Two embeddings are added, not concatenated. The token embedding says *what* the token is; the
position embedding says *where* it sits. Attention alone has no sense of order — remove the
position embedding and the sentence becomes a bag of tokens.

**Inside one TransformerBlock** the structure is pre-norm with two residual paths:

```
x -> LayerNorm -> attention    -> dropout -> + x
  -> LayerNorm -> feed-forward -> dropout -> + x
```

Each residual add gives gradients a short path back to the input, which is what makes deep
stacks trainable.

**Inside attention**, in order: project `x` into queries, keys, and values; score every query
against every key; apply the causal mask so position *i* can never see position *i+1*; scale
by `sqrt(head_dim)` and softmax; weight the values; project back out.

The mask is the reason this is a *language* model and not a text autoencoder — it is a
`triu(..., diagonal=1)` buffer that sets future positions to `-inf` before the softmax.

The output is **logits**, not probabilities and not text: one raw score per vocabulary entry,
at *every* position. During generation only the last position is used.

## Run it

### From the command line

Build the model and push four token ids through it:

```cmd
python -c "import torch; from llm_core.configs import MODEL_CONFIGS; from llm_core.model import GPTModel, count_parameters; cfg = MODEL_CONFIGS['random-tiny-byte']; m = GPTModel(cfg.to_dict()); x = torch.tensor([[85, 115, 101, 114]]); print('parameters', count_parameters(m)); print('logits', tuple(m(x).shape))"
```

Run the full smoke test, which reports the same parameter count:

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 02 · Forward pass**. The parameter count, context
length, and logits shape are read from `GET /models`, so they always describe the model that is
actually loaded rather than a hard-coded copy.

## What to observe

1. **`parameters 136704`.** The whole model is smaller than a photograph. Stage 08 loads one
   roughly 900× larger without changing a line of this code.
2. **`logits (1, 4, 257)`** — batch 1, four input positions, and 257 scores at each position.
   The last dimension is `vocab_size` from Stage 01; the output head is literally as wide as
   the tokenizer's vocabulary.
3. **A score exists at every position, not just the last one.** That is what makes training in
   Stage 04 efficient: one forward pass produces a prediction for every position at once.
4. **Sequence length is capped.** Pass more than `context_length` (64) ids and `forward`
   raises. That limit is the `pos_emb` table size, and it becomes a recurring constraint from
   Stage 06 onward.

## Exit check

You may continue when all of these are true:

- [ ] You can list the six stages of `GPTModel.forward` in order.
- [ ] You can explain why token and position embeddings are added.
- [ ] You can explain why attention needs a causal mask.
- [ ] You know what a logit is and why there are 257 of them per position.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Sequence length N exceeds context length 64` | More ids than the position table holds | Shorten the input, or use a model with a larger `context_length` |
| `d_out must be divisible by num_heads` | A custom config with mismatched `emb_dim` and `n_heads` | Keep `emb_dim % n_heads == 0` |
| Parameter count differs from 136,704 | The model config was edited | Compare against `MODEL_CONFIGS["random-tiny-byte"]` |

## Code map

| What | Where |
| --- | --- |
| `GPTModel`, `TransformerBlock`, `LayerNorm`, `FeedForward`, `GELU` | [`model.py`](../../packages/llm_core/llm_core/model.py) |
| Causal mask and attention order | `MultiHeadAttention.forward` in the same file |
| `count_parameters` | End of the same file |
| Tiny model config | [`configs.py`](../../packages/llm_core/llm_core/configs.py) → `random-tiny-byte` |
| CLI entry point | [`scripts/smoke_chat.py`](../../scripts/smoke_chat.py) |

## Next stage

[**Stage 03 · Decoding**](03-decoding.md) — turning that row of 257 scores into an actual next
token, and the two knobs that decide how.
