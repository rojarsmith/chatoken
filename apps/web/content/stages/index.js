import s01Tokens from "./s01-tokens";
import s02ForwardPass from "./s02-forward-pass";
import s03Decoding from "./s03-decoding";
import s04TrainingLoop from "./s04-training-loop";
import s05TrainingKnobs from "./s05-training-knobs";
import s06DataScale from "./s06-data-scale";
import s07Checkpoints from "./s07-checkpoints";
import s08PretrainedGpt2 from "./s08-pretrained-gpt2";
import s09PromptFormat from "./s09-prompt-format";
import s10InstructionSft from "./s10-instruction-sft";
import s11Lora from "./s11-lora";
import s12ChatSft from "./s12-chat-sft";
import s13YourOwnDataset from "./s13-your-own-dataset";
import s14CompareRuns from "./s14-compare-runs";
import s15ConversationMemory from "./s15-conversation-memory";
import s16StreamingCancel from "./s16-streaming-cancel";
import s17DeployLimits from "./s17-deploy-limits";
import t1ExternalModels from "./t1-external-models";

/** Stage id -> interactive content. Every stage on the ladder is now wired. */
export const STAGE_CONTENT = {
  "01-tokens": s01Tokens,
  "02-forward-pass": s02ForwardPass,
  "03-decoding": s03Decoding,
  "04-training-loop": s04TrainingLoop,
  "05-training-knobs": s05TrainingKnobs,
  "06-data-scale": s06DataScale,
  "07-checkpoints": s07Checkpoints,
  "08-pretrained-gpt2": s08PretrainedGpt2,
  "09-prompt-format": s09PromptFormat,
  "10-instruction-sft": s10InstructionSft,
  "11-lora": s11Lora,
  "12-chat-sft": s12ChatSft,
  "13-your-own-dataset": s13YourOwnDataset,
  "14-compare-runs": s14CompareRuns,
  "15-conversation-memory": s15ConversationMemory,
  "16-streaming-cancel": s16StreamingCancel,
  "17-deploy-limits": s17DeployLimits
};

/** Track id -> interactive content. Tracks sit beside the ladder, not on it. */
export const TRACK_CONTENT = {
  "external-models": t1ExternalModels
};
