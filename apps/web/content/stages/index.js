import s01Tokens from "./s01-tokens";
import s02ForwardPass from "./s02-forward-pass";
import s03Decoding from "./s03-decoding";
import s04TrainingLoop from "./s04-training-loop";
import s05TrainingKnobs from "./s05-training-knobs";
import s06DataScale from "./s06-data-scale";
import s07Checkpoints from "./s07-checkpoints";
import s08PretrainedGpt2 from "./s08-pretrained-gpt2";
import s09PromptFormat from "./s09-prompt-format";

/**
 * Stage id -> interactive content. A stage missing from this map still appears
 * on the ladder; its page points at the stage document and the legacy tab
 * until it is migrated.
 */
export const STAGE_CONTENT = {
  "01-tokens": s01Tokens,
  "02-forward-pass": s02ForwardPass,
  "03-decoding": s03Decoding,
  "04-training-loop": s04TrainingLoop,
  "05-training-knobs": s05TrainingKnobs,
  "06-data-scale": s06DataScale,
  "07-checkpoints": s07Checkpoints,
  "08-pretrained-gpt2": s08PretrainedGpt2,
  "09-prompt-format": s09PromptFormat
};
