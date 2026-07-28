"use client";

import TrainingRunner from "./TrainingRunner";
import { Metric } from "../ui/Bits";

/** Stage 12. Multi-turn transcripts, with the loss masked to assistant tokens only. */
export default function ChatSftPanel() {
  return (
    <TrainingRunner
      datasetId="chat-sft-lora"
      outputModelId="gpt2-chat-lora"
      defaults={{ max_steps: 240, batch_size: 1, block_size: 384, learning_rate: 0.0003, eval_every: 10 }}
      samplePrompt="who are you?"
      runLabel="Run chat SFT"
      beforeLabel="Before (raw GPT-2)"
      afterLabel="After (chat SFT)"
      extraMetrics={(summary) => (
        <>
          <Metric label="Train examples" value={summary.train_examples ?? "—"} />
          <Metric label="Objective" value={summary.training_objective} />
        </>
      )}
    >
      <p>
        A conversation needs more than single-turn answering: the model must read a history and
        produce only the next assistant turn. The new idea is what happens to the targets.
      </p>
      <pre className="lx-flow">{`tokens:   System: ... User: ... Assistant:   A nice reply here
targets:  -100  -100  -100  -100  -100  -100  A  nice  reply  here  <eos>
          |<-------- ignored -------->|       |<-- loss applies -->|`}</pre>
      <p className="lx-note">
        Prompt positions are set to <code>-100</code>, which PyTorch&apos;s{" "}
        <code>cross_entropy</code> skips. The model is never rewarded for predicting the
        user&apos;s words — without this it would spend most of its capacity learning to generate
        plausible user turns, which is exactly the base-GPT-2 failure you saw in Stage 08.
      </p>
      <p className="lx-note">
        240 steps is 12× Stage 10 for a smaller behavior gain: turn structure is harder to learn
        than answer shape. CUDA is strongly recommended — this is a long run on CPU.
      </p>
    </TrainingRunner>
  );
}
