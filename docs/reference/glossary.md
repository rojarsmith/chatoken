# Reference · Glossary

[English](glossary.md) | [繁體中文](glossary.zh-TW.md)

[Course index](../README.md)

Terms in the order a learner meets them, with the stage that introduces each.

## Part 1 · Generate

**Token** *(01)* — the unit a model actually processes. Not a word and not a character: an
integer id produced by a tokenizer.

**Tokenizer** *(01)* — the fixed, unlearned component that maps text to ids and back. This
project has two: `ByteTokenizer` (one UTF-8 byte per token, vocabulary 257) and
`GPT2Tokenizer` (BPE, vocabulary 50,257).

**Vocabulary size** *(01)* — how many distinct ids exist. It is also the width of the model's
output layer, which is why changing tokenizer means changing model.

**BPE** *(01, 08)* — byte-pair encoding. Learned merge rules that pack common character
sequences into single tokens.

**EOS** *(01, 03)* — the end-of-sequence id (256 for bytes, 50,256 for GPT-2). Sampling it
ends generation early.

**Embedding** *(02)* — a lookup table turning an id into a vector. Token embeddings say
*what*; position embeddings say *where*. They are added, not concatenated.

**Logits** *(02)* — raw, unnormalized scores, one per vocabulary entry, at every position.
Not probabilities, not text.

**Causal mask** *(02)* — the upper-triangular `-inf` mask that stops position *i* from
attending to anything after it. It is what makes this a language model.

**Residual connection** *(02)* — adding a block's input to its output, giving gradients a
short path back.

**Context length** *(02, 15)* — the largest sequence the model can process, fixed by the
position embedding table. 64 for the tiny model, 1,024 for GPT-2. A hard limit.

**Temperature** *(03)* — the sampling knob. `0` means always take the highest score; above `0`
divides the logits before sampling. Below 1 sharpens, above 1 flattens.

**Top-k** *(03)* — restricting the candidate set to the *k* highest-scoring ids before
sampling.

**Greedy decoding** *(03)* — `temperature=0`. Deterministic; identical output every run.

## Part 2 · Train

**Loss** *(04)* — how surprised the model was by the correct answer. Cross-entropy here. A
uniform guess over 257 ids scores `ln(257) ≈ 5.55`.

**Cross-entropy** *(04)* — the loss function comparing a predicted distribution against the
one correct id.

**Step** *(04, 05)* — one optimizer update on one batch. Not one pass over the data.

**Batch size** *(05)* — windows per step. Larger smooths gradients and costs memory.

**Block size** *(05)* — the training window length in tokens. Cannot exceed `context_length`.

**Learning rate** *(05)* — optimizer step size. The stability knob: too high diverges, too low
stalls.

**AdamW** *(04, 17)* — the optimizer used throughout. It keeps two state tensors per
parameter, which dominates training memory.

**Epoch** *(05)* — one full pass over the dataset. This project counts steps instead, because
its datasets are small enough to be read many times.

**Overfitting** *(04, 06)* — memorizing training data rather than learning a pattern.
Deliberate and useful in Stage 04; the thing to escape in Stage 06.

**Checkpoint** *(07)* — a saved file containing weights, config, tokenizer name, training
summary, and lineage. In this project always a full snapshot, never a delta.

**Lineage** *(07)* — the `base_model_id` chain recording what a model was trained from.

## Part 3 · Reuse

**Pretrained model** *(08)* — weights someone else trained, loaded into the same architecture.

**Base model** *(08)* — a model trained only to continue text. It answers questions with more
text, not with answers.

**Prompt template** *(09)* — the wrapper around your message: `raw`, `chat`, `instruction`, or
`custom`. Costs tokens; changes behavior; changes no weights.

**Inference mode** *(09)* — a named bundle of decoding settings: `greedy`, `focused`,
`creative`, or `manual`.

## Part 4 · Align

**SFT** *(10)* — supervised fine-tuning. Training on examples that demonstrate the behavior
you want.

**Instruction tuning** *(10)* — SFT on (instruction, response) pairs so a base model answers
rather than continues.

**Catastrophic forgetting** *(10)* — losing existing ability by fine-tuning too hard. The
reason the learning rate drops ~60× from Part 2.

**LoRA** *(11)* — low-rank adaptation. Freeze the base, train small `A`/`B` matrices beside
targeted layers.

**Rank** *(11)* — the bottleneck width of a LoRA adapter. Higher fits more and costs more.

**Adapter** *(11)* — the small trainable addition to a frozen model. Merged into a full
checkpoint here.

**PEFT** *(11)* — parameter-efficient fine-tuning; the family LoRA belongs to.

**Loss masking** *(12)* — setting target positions to `-100` so `cross_entropy` skips them.
Used to train only on assistant tokens.

**Train/eval split** *(13)* — holding examples back from training so they can test
generalization. Held out *before* looking at results, or it proves nothing.

## Part 5 · Ship

**Stateless** *(15)* — the model retains nothing between calls. All apparent memory is the
application re-sending history.

**Context window** *(15)* — the model's real limit on how much history it can attend to. Not
the same as the application's history budget.

**Streaming** *(16)* — emitting tokens as they are generated instead of after the loop ends.
Changes perceived latency, not total time.

**Cooperative cancellation** *(16)* — a worker checking a flag at safe points and exiting
cleanly, rather than being killed.

**KV cache** *(17)* — cached keys and values that let production servers skip recomputation.
Estimated here but not implemented; this loop recomputes each token.

**Concurrency** *(17)* — simultaneous requests. Weights are paid once; context memory is paid
per request.

**Precision** *(17)* — the numeric format of weights. fp16 halves the parameter pool and
nothing else.
