# Model Foundations

[English](model-foundations.md) | [繁體中文](model-foundations.zh-TW.md)

This stage fixes the gap before training: learners should see how the local GPT model is assembled before they press `Start`.

The Web UI now places these pages before Chat and From Scratch:

```text
GPT Model -> Training Config -> Chat -> From Scratch -> Raw Text -> GPT-2 -> Instruction
```

## GPTModel Build Order

The local model follows the same teaching path as the reference project:

```text
Chapter 3: attention
Chapter 4: GPTModel
Chapter 5: training loop
```

The implementation is in `packages/llm_core/llm_core/model.py`:

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

The important point is that `GPTModel` is not a single external GPT library call. It is assembled from local classes:

- `MultiHeadAttention`
- `GELU`
- `FeedForward`
- `LayerNorm`
- `TransformerBlock`
- `GPTModel`

PyTorch is still used for tensors, matrix multiplication, gradients, and modules. The learning target is the model structure and data flow.

## TransformerBlock Build Order

Each block uses a pre-norm residual structure:

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

This is the first place where learners should understand why attention, normalization, feed-forward layers, and residual paths are separate ideas.

## TrainingConfig Knobs

The implementation is in `packages/llm_core/llm_core/training.py`.

Important knobs:

- `max_steps`: optimizer updates. More steps means more chances to fit data.
- `batch_size`: windows per update. Larger values smooth gradients but use more memory.
- `block_size`: token window length. Larger values teach longer context but cost more memory.
- `stride`: how far the training window moves through text.
- `learning_rate`: optimizer step size.
- `eval_every`: progress logging frequency.
- `sample_prompt`: fixed prompt used for before/after comparison.
- `prompt_style`: chat, raw text, or instruction formatting.
- `sample_tokens`: generated length for comparison.
- `seed`: repeatability for initialization and shuffling.

The Web UI `Training Config` page changes the same state used by the training form, then estimates tokens per step, total tokens seen, text windows, and loss snapshots.

## Learning Checkpoint

Before running From Scratch training, the learner should be able to explain:

1. Why token and position embeddings are added.
2. Why attention needs a causal mask.
3. Why `block_size` cannot exceed model `context_length`.
4. Why `learning_rate` changes stability.
5. Why loss can decrease even if generated text is still rough.
