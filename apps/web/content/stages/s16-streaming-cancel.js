import StreamingPanel from "../../components/panels/StreamingPanel";

export default {
  concept: {
    paragraphs: [
      "Stage 03 established that generation is a loop producing one token per iteration. Every endpoint so far hid that: the request blocked until the loop ended, then returned everything. For an 80-token answer on CPU, that is a long silence.",
      "Streaming exposes the loop that was always there. Each event carries both the delta and the reply so far, so a client can either append or replace. No new model capability is involved."
    ],
    flow: `{"event":"start","model_id":"random-tiny-byte","prompt_tokens":31}
{"event":"token","delta":"A","reply":"A","tokens_generated":1}
{"event":"done","result":{"model_id":"random-tiny-byte","reply":"..."}}`,
    table: {
      head: ["State when cancelled", "Result"],
      rows: [
        ["queued", "Becomes cancelled immediately — it never started"],
        ["running", "Continues to the next safe checkpoint, then stops and records cancelled"]
      ]
    },
    note: "The API never kills a thread or the process. In the training loop the cancel flag is checked between steps, so a cancelled run stops between optimizer updates rather than mid-update. Forced termination is fast and unsafe; cooperative cancellation is safe and slightly late. Production systems overwhelmingly choose the latter."
  },
  observe: [
    "The first token event arrives long before the answer is complete. Perceived latency drops even though total time does not change at all.",
    "The start event carries prompt_tokens before any generation, so a client can show context cost immediately.",
    "A cancelled queued job flips instantly; a cancelled running job takes until the next step boundary. Measure both — the difference is the lesson.",
    "cancel_requested is visible in the job payload even while the status is still running. The flag and the state are separate.",
    "No checkpoint is written for a cancelled training job — cancellation stops before the save.",
    "Streaming does not change the output. At temperature 0, streamed and blocking calls produce identical text."
  ],
  exitCheck: [
    "You can name the three event types and what each carries.",
    "You can explain why cancellation is cooperative rather than forced.",
    "You have cancelled a job and observed how long it took to reach cancelled.",
    "You can state what streaming changes and what it does not."
  ],
  Panel: StreamingPanel
};
