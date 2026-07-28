import CheckpointPanel from "../../components/panels/CheckpointPanel";

export default {
  concept: {
    paragraphs: [
      "Every training run writes one .pt file to models/checkpoints/. That file is the entire result of the run.",
      "It is a full snapshot, not a delta. Loading one does not require replaying earlier checkpoints — which differs from adapter formats, including the LoRA you meet in Stage 11. Chatoken merges LoRA back into a full checkpoint precisely so that one loader handles every model."
    ],
    flow: `checkpoint_id      unique id derived from model_id and timestamp
model_id           what this model is called
base_model_id      what it was trained from        <- lineage
version            version_id, label, lineage, run_config, metrics
model_config       vocab_size, context_length, emb_dim, n_heads, ...
tokenizer          byte or gpt2
training_summary   losses, tokens_seen, before/after samples
state_dict         every weight in the model`,
    note: "It does not contain code. state_dict is a dictionary of tensors keyed by layer name; rebuilding the model needs the GPTModel source and the saved model_config. That is why the config travels with the weights."
  },
  observe: [
    "Every checkpoint names its parent. The models from Stage 06 all report base_model_id random-tiny-byte — same parent, different data.",
    "run_config recovers the experiment: dataset, max_steps, and learning_rate are in the file, so a run is reproducible from the artifact alone.",
    "metrics.final_loss differs sharply across the ladder and matches what scrolled past during training.",
    "The state_dict keys mirror the module tree from Stage 02 — tok_emb.weight, pos_emb.weight, trf_blocks.0.att.W_query.weight.",
    "load_when_complete did this automatically in earlier stages. Doing it by hand once shows you the step that was hidden.",
    "Older checkpoints without version metadata still load — the API derives a fallback version rather than rejecting the file."
  ],
  exitCheck: [
    "You can list what a checkpoint contains without opening one.",
    "You can explain why a checkpoint is useless without compatible model code.",
    "You have loaded a checkpoint manually and chatted with it.",
    "You can trace one model back to the dataset and settings that produced it."
  ],
  Panel: CheckpointPanel
};
