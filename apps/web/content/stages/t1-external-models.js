import ExternalPanel from "../../components/panels/ExternalPanel";

export default {
  concept: {
    paragraphs: [
      "Every stage in the course adds a layer to the same model. This one does not: calling somebody else's API teaches you nothing about tokenizers, training loops, checkpoints, or fine-tuning.",
      "It is still worth doing once. It gives you a reference point for how far a lightly tuned GPT-2 is from a production assistant, and it demonstrates the one security boundary in this project."
    ],
    table: {
      head: ["Provider", "Model id", "Calls"],
      rows: [
        ["openai-compatible", "openai-compatible", "Any /chat/completions-compatible endpoint"],
        ["ollama", "ollama-local", "A local Ollama /api/chat endpoint"]
      ]
    },
    note: "There is no mock provider — a fake reply would defeat the purpose of a comparison. Provider keys are read from environment variables by the API process and never leave it."
  },
  observe: [
    "The gap is large, and worth seeing plainly. A hosted model answers; your checkpoint approximates the shape of an answer.",
    "The preview shows the full outgoing payload. You can read exactly what leaves your machine before it leaves.",
    "No credential appears in any browser-visible response — check the network tab if you like. That is the point of the boundary.",
    "top_k is previewed but not sent to OpenAI-compatible endpoints. Provider APIs are not the same surface as your local generate function.",
    "Latency and failure modes differ: network errors, rate limits, and per-token billing are costs the local path does not have."
  ],
  exitCheck: [
    "You have compared one local checkpoint against a real provider on the same message.",
    "You can explain why the API calls the provider instead of the browser doing it.",
    "You can name one parameter that does not survive the trip to a provider.",
    "You can state what this track does not teach you about building models."
  ],
  Panel: ExternalPanel
};
