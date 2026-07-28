import ForwardPassPanel from "../../components/panels/ForwardPassPanel";

export default {
  concept: {
    paragraphs: [
      "GPTModel is not a call into an external GPT library. It is assembled in this project from six local classes: MultiHeadAttention, GELU, FeedForward, LayerNorm, TransformerBlock, and GPTModel. PyTorch supplies tensors, autograd, and nn.Module — the architecture is yours.",
      "Two embeddings are added, not concatenated. The token embedding says what the token is; the position embedding says where it sits. Attention alone has no sense of order — remove the position embedding and the sentence becomes a bag of tokens."
    ],
    flow: `token ids                       [batch, seq_len]
  -> token embedding      +
     position embedding         [batch, seq_len, emb_dim]
  -> dropout
  -> TransformerBlock × n_layers
  -> final LayerNorm
  -> output head (Linear)       [batch, seq_len, vocab_size]
  = logits`,
    steps: [
      {
        code: "tok_emb + pos_emb",
        title: "What, plus where",
        body: "Each id becomes a learned vector; a position vector is added so order carries meaning."
      },
      {
        code: "trf_blocks",
        title: "Mix without reshaping",
        body: "Attention and feed-forward layers move information between positions and preserve the sequence shape."
      },
      {
        code: "mask",
        title: "The causal mask",
        body: "A triu(..., diagonal=1) buffer sets future positions to -inf before the softmax. It is what makes this a language model."
      },
      {
        code: "out_head",
        title: "Logits, not text",
        body: "One raw score per vocabulary entry, at every position. Not probabilities and not words."
      }
    ],
    note: "Each residual add gives gradients a short path back to the input, which is what makes deep stacks trainable at all."
  },
  observe: [
    "The tiny model holds 136,704 parameters — smaller than a photograph. Stage 08 loads one roughly 900× larger without changing a line of this code.",
    "The last dimension of the logits equals vocab_size from Stage 01. The output head is exactly as wide as the tokenizer's vocabulary.",
    "A score exists at every position, not just the last one — that is what makes Stage 04's training efficient.",
    "Sequence length is capped by context_length (64 here). Pass more ids and forward raises; that limit is the position table size.",
    "Switch the active model in the Playground and every number here changes, because they are read from GET /models."
  ],
  exitCheck: [
    "You can list the six stages of GPTModel.forward in order.",
    "You can explain why token and position embeddings are added.",
    "You can explain why attention needs a causal mask.",
    "You know what a logit is and why there are 257 of them per position."
  ],
  Panel: ForwardPassPanel
};
