import ChatSftPanel from "../../components/panels/ChatSftPanel";

export default {
  concept: {
    paragraphs: [
      "Stage 10 taught single-turn answering: one instruction in, one response out. A conversation needs something more — the model must read a history and produce only the next assistant turn.",
      "ChatTranscriptDataset splits each transcript into (prompt, response) pairs, where the prompt is everything said so far. The new idea is what happens to the targets: prompt positions are set to -100, which cross_entropy skips."
    ],
    table: {
      head: ["Setting", "Stage 11 (instruction)", "Stage 12 (chat)"],
      rows: [
        ["max_steps", "20", "240"],
        ["block_size", "256", "384"],
        ["objective", "instruction-lora", "chat-lora"],
        ["prompt_style", "instruction", "chat"],
        ["output", "gpt2-instruct-lora", "gpt2-chat-lora"]
      ]
    },
    note: "When a transcript is too long, prompt tokens are dropped from the front while the response is preserved. Old history is expendable; the thing being learned is not."
  },
  observe: [
    "It stops writing both sides of the conversation. Compare against base GPT-2 in the same session format — this is the effect of loss masking.",
    "It answers from context. \"What is my name?\" works because the fact is in the rendered transcript, not because the model stored it anywhere.",
    "240 steps is 12× Stage 10 for a smaller behavior gain. Turn structure is harder to learn than answer shape.",
    "It still fails plenty of open questions. A few hundred transcripts against a 124M base is a demonstration, not a product.",
    "training_objective chat-lora and prompt_style chat are recorded, so Stage 14 will not compare this against an instruction run.",
    "Then go to Stage 15 and hold a two-turn session with gpt2-chat-lora using the chat-transcript format."
  ],
  exitCheck: [
    "You can explain what -100 does in the target tensor and why it matters.",
    "You can explain why prompt tokens are truncated from the front, not the back.",
    "You have held a two-turn session where the second answer depends on the first turn.",
    "You can state honestly what this checkpoint can and cannot do."
  ],
  Panel: ChatSftPanel
};
