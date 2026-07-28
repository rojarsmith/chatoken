"use client";

import TrainingRunner from "./TrainingRunner";
import { Metric } from "../ui/Bits";

const PROMPT = "Explain what a model checkpoint is in one sentence.";

/** Stage 11. Freeze the base, train two small matrices beside each targeted layer. */
export default function LoraPanel() {
  return (
    <TrainingRunner
      datasetId="instruction-lora"
      outputModelId="gpt2-instruct-lora"
      defaults={{ max_steps: 20, batch_size: 1, block_size: 256, learning_rate: 0.0003, eval_every: 5 }}
      samplePrompt={PROMPT}
      runLabel="Run LoRA fine-tuning"
      beforeLabel="Before (raw GPT-2)"
      afterLabel="After (LoRA)"
      extraMetrics={(summary) =>
        summary.lora ? (
          <>
            <Metric label="rank" value={summary.lora.rank} hint={`alpha ${summary.lora.alpha}`} />
            <Metric
              label="Adapted layers"
              value={(summary.lora.target_modules ?? []).join(", ")}
            />
          </>
        ) : null
      }
    >
      <p>
        For a frozen linear layer <code>W</code>, LoRA adds two much smaller matrices —{" "}
        <code>A</code> of shape <code>[rank, in]</code> and <code>B</code> of{" "}
        <code>[out, rank]</code> — and trains only those:
      </p>
      <pre className="lx-flow">{`output = W·x  +  (B · A · x) × (alpha / rank)
         ^^^     ^^^^^^^^^^^
         frozen  trainable`}</pre>
      <p className="lx-note">
        <code>lora_b</code> is initialised to zeros while <code>lora_a</code> uses Kaiming init,
        so at step 0 the product <code>B·A</code> is exactly zero and the adapted model is
        numerically identical to frozen GPT-2. Training departs from GPT-2 rather than from
        noise — that is what makes LoRA safe to attach to a working model.
      </p>
      <p className="lx-note">
        Learning rate is <code>3e-4</code> here, six times Stage 10&apos;s <code>5e-5</code>.
        Fewer parameters carry the whole adjustment, so each one has to move further.
      </p>
    </TrainingRunner>
  );
}
