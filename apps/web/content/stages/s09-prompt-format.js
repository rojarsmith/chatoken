import PromptFormatPanel from "../../components/panels/PromptFormatPanel";

export default {
  concept: {
    paragraphs: [
      "No training happens in this stage. Everything here is inference-time, and it separates three things that are easy to confuse: your message is wrapped by a prompt template, converted to token ids, then decoded by a sampling policy.",
      "A fifth style value, model-default, resolves to whatever the loaded model's config declares — chat for random-tiny-byte, instruction for GPT-2. That is why the same request behaves differently against different models without you changing anything."
    ],
    table: {
      head: ["Style", "Rendered form"],
      rows: [
        ["raw", "The message alone — nothing added"],
        ["chat", "User: {message} then Assistant:"],
        ["instruction", "Task description, ### Instruction:, then ### Response:"],
        ["custom", "Your own template; must contain {message} or {instruction}"]
      ]
    },
    note: "prompt-preview renders the prompt and reports the token math without generating anything, so you can inspect the input surface before judging the output."
  },
  observe: [
    "prompt_tokens rises with template weight. raw costs nothing; instruction costs several dozen tokens before your message is read.",
    "model-default resolves differently per model — the same request reports a different effective style against the tiny model and against GPT-2.",
    "remaining_context_tokens shrinks as the template grows. With GPT-2's 1,024-token window there is room; with the tiny model's 64 there is not, and warnings appear.",
    "The prompt shown is the exact text that will be tokenized. No hidden additions — compare it against your template character by character.",
    "greedy output is identical across runs; creative is not. Same weights, same prompt, different policy.",
    "None of the templates make GPT-2 answer the question. Try the instruction template on a real request and read the result honestly."
  ],
  exitCheck: [
    "You can render the same message in all four styles and predict which costs most tokens.",
    "You know what model-default resolves to for each loaded model.",
    "You have written a custom template and confirmed the rendered prompt exactly.",
    "You can state what prompting cannot fix."
  ],
  Panel: PromptFormatPanel
};
