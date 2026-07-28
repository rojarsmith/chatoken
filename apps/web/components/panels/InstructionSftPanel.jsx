"use client";

import TrainingRunner from "./TrainingRunner";
import { Metric } from "../ui/Bits";

const PROMPT = "Explain what a model checkpoint is in one sentence.";

/** Stage 10. Full fine-tuning: every one of GPT-2's parameters receives gradients. */
export default function InstructionSftPanel() {
  return (
    <TrainingRunner
      datasetId="instruction-following"
      outputModelId="gpt2-instruct-finetuned"
      defaults={{ max_steps: 20, batch_size: 1, block_size: 256, learning_rate: 0.00005, eval_every: 5 }}
      samplePrompt={PROMPT}
      runLabel="Run instruction SFT"
      beforeLabel="Before (raw GPT-2)"
      afterLabel="After (instruction SFT)"
      extraMetrics={(summary) => (
        <Metric label="Examples used" value={summary.examples_used_for_training ?? "—"} />
      )}
    >
      <p>
        The loop is unchanged from Stage 04 — next-token prediction, cross-entropy, AdamW. What
        changed is the text: each example is rendered into the instruction template with the
        answer after <code>### Response:</code>, so the data now demonstrates the behavior you
        want.
      </p>
      <p className="lx-note">
        The learning rate drops from <code>3e-3</code> in Part 2 to <code>5e-5</code> here —
        roughly 60× smaller. You are adjusting a model that already works. Large steps destroy
        existing ability, and that failure has a name: catastrophic forgetting.
      </p>
    </TrainingRunner>
  );
}
