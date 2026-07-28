import DeployPanel from "../../components/panels/DeployPanel";

export default {
  concept: {
    paragraphs: [
      "Everything so far assumed a single user on one machine. Deployment is mostly about what breaks when that assumption goes away — and the answer is memory, in four distinct pools.",
      "Attention scratch deserves the emphasis: scores are computed for every query against every key, so the cost grows with the square of context length. Doubling the window roughly quadruples that pool."
    ],
    table: {
      head: ["Pool", "Grows with", "Notes"],
      rows: [
        ["parameter_bytes", "model size × precision", "Fixed per loaded model. fp16 halves it"],
        ["kv_cache_like_bytes", "context × concurrency", "What production servers cache per request"],
        ["attention_scratch_bytes", "context SQUARED", "The one that surprises people"],
        ["adamw_training_state_bytes", "trainable params × 2", "Only during training"]
      ]
    },
    note: "Three deployment shapes follow: local development; split API and web, where NEXT_PUBLIC_API_BASE_URL is the only browser-visible config and provider keys must never live in the web process; and a GPU API worker, where the web app can sit on a small CPU host but the API must run where the model does."
  },
  observe: [
    "Concurrency multiplies everything except weights. The parameter pool is flat; the rest scales linearly with request count.",
    "Doubling context more than doubles the total. Find attention_scratch_bytes and confirm the quadratic growth yourself.",
    "Training costs far more than inference — gradients plus two AdamW states per parameter, on top of activations.",
    "fp16 halves the parameter pool and nothing else. Precision is not a universal discount.",
    "Warnings fire on real mistakes: prompt_tokens + max_new_tokens past the context window, or block_size > context_length — the same constraint from Stage 05.",
    "The estimator is a teaching tool, not a profiler. It gives you the shape of the cost and which dimension dominates; real capacity planning needs measurement."
  ],
  exitCheck: [
    "You can name which memory pool grows with the square of context length.",
    "You can explain why weights are paid once but context is paid per request.",
    "You know why provider API keys must never reach the web process.",
    "You can describe the three deployment shapes and when each applies."
  ],
  Panel: DeployPanel
};
