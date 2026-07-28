import TrainingPanel from "../../components/panels/TrainingPanel";

export default {
  concept: {
    paragraphs: [
      "Everything in Part 1 was inference: the weights were random and stayed random. Training is a loop that repeats four steps until you stop it.",
      "The training signal is free. No one labels this data. TokenDataset slides a window of block_size over the token ids and pairs each window with the same window shifted by one, so the answer is already in the text."
    ],
    flow: `  batch ──▶ model ──▶ logits ──▶ cross_entropy(logits, targets) ──▶ loss
                                                                     │
    weights ◀── optimizer.step() ◀── gradients ◀── loss.backward() ◀─┘`,
    steps: [
      {
        code: "cross_entropy",
        title: "Loss measures surprise",
        body: "A model guessing uniformly over 257 ids scores ln(257) ≈ 5.55. Every point below that is knowledge it did not have before."
      },
      {
        code: "max_steps",
        title: "One step is one batch",
        body: "80 steps means 80 batches, not 80 passes over the data. AdamW adjusts every trainable parameter after each one."
      },
      {
        code: "every-effort",
        title: "A dataset that should be memorized",
        body: "Four repetitions of the same two lines. Overfitting here is the cheapest possible proof that learning happened at all."
      }
    ],
    note: "Stage 06 is where overfitting stops being a good thing. For now it is the evidence."
  },
  observe: [
    "The before sample is escaped bytes — the Stage 03 baseline, printed again so the comparison sits in one place.",
    "Step 1 loss is close to 5.55. The model starts out as an expensive coin flip over 257 possibilities.",
    "Loss falls fast and far. On a dataset this small it should approach zero, because there is almost nothing to learn.",
    "tokens_seen grows by batch_size × block_size per step — 128 tokens per step at the defaults.",
    "The after sample contains recognizable fragments of the training text — pieces like Every, forwar, and Ast: instead of random bytes. It does not reproduce the sentence cleanly even at 800 steps: a 2-layer, 64-dimension byte model lacks the capacity. \"Learned this file\" and \"can reproduce this file\" are different claims.",
    "A checkpoint id is printed. That file is the entire result of the run, and Stage 07 opens it."
  ],
  exitCheck: [
    "You can explain where the training targets come from without the word \"label\".",
    "You know what number an untrained byte-tokenizer model's loss starts near, and why.",
    "You have compared the same prompt before and after training.",
    "You can state why overfitting on every-effort is the expected outcome here."
  ],
  Panel: TrainingPanel
};
