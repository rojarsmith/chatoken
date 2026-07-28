import LoraPanel from "../../components/panels/LoraPanel";

export default {
  concept: {
    paragraphs: [
      "Full fine-tuning updates every weight. LoRA freezes the original model and trains a small pair of matrices beside each targeted layer instead.",
      "With rank 8 against GPT-2's 768-wide attention projections, A and B together hold about 8 × 768 × 2 = 12,288 numbers where W holds 768 × 768 = 589,824. That is the entire saving, repeated at every targeted layer."
    ],
    table: {
      head: ["Field", "Default", "Meaning"],
      rows: [
        ["rank", "8", "Width of the bottleneck. Higher fits more, costs more"],
        ["alpha", "16", "Scaling numerator; effective scale is alpha / rank = 2"],
        ["dropout", "0.05", "Dropout on the adapter input path only"],
        ["target_modules", "W_query, W_value", "Only queries and values — a choice you can change"]
      ]
    },
    note: "The merge step is why Stage 07's loader still works: W_merged = W + (B·A) × scaling, saved as an ordinary full checkpoint. You trade runtime adapter swapping for a much simpler system — a reasonable trade for a teaching project, and an explicit one."
  },
  observe: [
    "trainable_percent is the headline. Compare it against Stage 10, where the ratio was 100%.",
    "Output quality is broadly comparable. Two very different parameter counts, similar behavior change — that is the claim LoRA makes, and you can check it here.",
    "The learning rate is six times higher. Fewer parameters carry the whole adjustment, so each one moves further; reusing 5e-5 here does almost nothing.",
    "Memory use drops because gradients and AdamW state exist only for the adapters. Frozen weights still occupy memory for the forward pass — this reduces training cost, not model size.",
    "The saved checkpoint looks completely ordinary. Only tuning_method: lora reveals how it was produced.",
    "It is still slow on CPU: fewer trainable parameters, but every step still runs a full GPT-2 forward and backward pass."
  ],
  exitCheck: [
    "You can explain what rank controls and why alpha / rank appears in the forward pass.",
    "You can explain why zero-initializing lora_b matters.",
    "You can name which GPT-2 layers received adapters and which did not.",
    "You can explain why the saved checkpoint needs no adapter loader."
  ],
  Panel: LoraPanel
};
