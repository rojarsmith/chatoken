import InstructionSftPanel from "../../components/panels/InstructionSftPanel";

export default {
  concept: {
    paragraphs: [
      "Everything in Part 2 trained on plain text: the target was simply the next token in the file. Supervised fine-tuning changes what the text is, not how the loop works.",
      "Each example is rendered into a single training string using the instruction template from Stage 09, with the answer following ### Response:. Then it is trained exactly as Stage 04 trained on every-effort. The mechanism is unchanged; the data now demonstrates the behavior you want."
    ],
    note: "The model does not learn obedience. It learns that this particular prompt shape is followed by a completion of a particular kind. Every one of the ~163M parameters receives gradients, and AdamW keeps two optimizer states per parameter — that memory cost is the motivation for Stage 11."
  },
  observe: [
    "The before/after pair is the whole stage. Base GPT-2 continues; the fine-tuned model attempts an answer. Read both in full before looking at any number.",
    "Twenty steps is enough to change behavior visibly. Alignment is a much smaller intervention than pretraining.",
    "batch_size is 1 and block_size is 256. Instruction examples are long and full fine-tuning is memory-hungry — the two constraints push the same way.",
    "Quality is still poor. A few hundred examples and twenty steps produce the shape of an answer, not a good one. That distinction is worth sitting with.",
    "trainable_percent reads 100% — every parameter is being updated. Compare it against Stage 11.",
    "The run records training_objective instruction-sft, which Stage 14 uses to refuse unfair comparisons."
  ],
  exitCheck: [
    "You can explain what changed relative to Stage 04 — and what did not.",
    "You can explain why the learning rate is ~60× smaller than in Part 2.",
    "You have a before/after pair for the same prompt.",
    "You can name the resource cost that motivates LoRA."
  ],
  Panel: InstructionSftPanel
};
