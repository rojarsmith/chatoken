import ConversationPanel from "../../components/panels/ConversationPanel";

export default {
  concept: {
    paragraphs: [
      "Nothing you have built remembers anything. generate takes a tensor of ids and returns a longer one; between two calls the model retains nothing whatsoever.",
      "Everything that feels like memory in a chat product is the application re-sending the history on every turn. Two separate limits decide how much survives, and confusing them causes most \"the model forgot\" bugs."
    ],
    flow: `turn 3 request
  = system prompt
  + turn 1 user + turn 1 assistant
  + turn 2 user + turn 2 assistant
  + turn 3 user
  -> rendered into one string -> tokenized -> generate`,
    table: {
      head: ["Limit", "Owner", "Value"],
      rows: [
        ["max_history_messages", "your policy", "how many recent messages to render"],
        ["context_token_budget", "your policy", "a token ceiling the renderer applies"],
        ["context_length", "architecture", "64 for the tiny model, 1,024 for GPT-2 — hard"]
      ]
    },
    note: "Match the rendering format to how the model was trained: chat-transcript for gpt2-chat-lora from Stage 12, instruction-request for the instruction-tuned checkpoints."
  },
  observe: [
    "The preview shows the entire prompt, system line included. Nothing is hidden from you that is not hidden from the model.",
    "random-tiny-byte drops almost everything. With context_length 64, the stored transcript far exceeds what the model can attend to, and the warning says so.",
    "Two different omission counts are reported — history limit and token budget. They are separate policies and can fire independently.",
    "Raising max_history_messages does not raise context_length. Application policy cannot exceed architecture; try it and watch the warning persist.",
    "Each stored message records the model that produced it, so switching models mid-session leaves a mixed history rather than rewriting old turns.",
    "Restarting the API empties everything — sessions are in process memory by design."
  ],
  exitCheck: [
    "You can explain why the model appears to remember without storing anything.",
    "You can name the two application limits and the one architectural limit.",
    "You have previewed a context that was truncated, and can say which limit caused it.",
    "You can match a context format to the way a checkpoint was trained."
  ],
  Panel: ConversationPanel
};
