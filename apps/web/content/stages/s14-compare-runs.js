import ExperimentsPanel from "../../components/panels/ExperimentsPanel";

export default {
  concept: {
    paragraphs: [
      "You now have a pile of checkpoints and a natural question: which one is best? The answer is usually \"that question is not well formed yet.\"",
      "A loss number means nothing on its own. A run on every-effort reaches near-zero loss and is worthless; a run on the-verdict stalls much higher and learned far more. Loss is only comparable within a fixed setup."
    ],
    flow: `same prompt?
same dataset?
same base model?
same objective?
same tuning method?`,
    note: "The order of operations is the lesson: sameness summary, then config difference, then loss delta, then samples. Reversing it is how people convince themselves of things that are not true — generated text is the most persuasive and least reliable evidence available."
  },
  observe: [
    "The summary comes first, deliberately. The API returns sameness before metrics because the metrics are meaningless until the sameness is checked.",
    "An unfair comparison reports multiple different fields, each with a note. A lower loss there proves nothing.",
    "Full SFT and LoRA are close on output and far apart on trainable_percent. This is the one comparison in the course where a real trade-off is visible with everything else held constant.",
    "tuning_method defaults to full for runs that predate LoRA, so older records still compare cleanly.",
    "final_loss across the dataset ladder is not a ranking. Line up Stage 06's runs and confirm the lowest loss belongs to the least useful model.",
    "Before/after samples come from the same comparison_prompt for a given dataset — which is why that field exists in the dataset spec."
  ],
  exitCheck: [
    "You can list the five fields that must match before a comparison means anything.",
    "You have deliberately run an invalid comparison and read the notes.",
    "You can explain why the lowest loss in your experiment log is not the best model.",
    "You read summary and config before samples, every time."
  ],
  Panel: ExperimentsPanel
};
