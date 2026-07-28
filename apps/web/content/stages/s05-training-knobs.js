import KnobsPanel from "../../components/panels/KnobsPanel";

export default {
  concept: {
    paragraphs: [
      "Nothing in GPTModel changes in this stage. Every knob belongs to TrainingConfig, which controls how data is fed to the model and how large each correction is.",
      "Three relationships are worth holding in your head: tokens per step is batch_size × block_size; the number of training windows is (dataset tokens − block_size) / stride; and block_size can never exceed the model's context_length."
    ],
    table: {
      head: ["Knob", "Default", "What it changes"],
      rows: [
        ["max_steps", "80", "How many optimizer updates run"],
        ["batch_size", "4", "Windows per update. Larger smooths gradients, costs memory"],
        ["block_size", "32", "Token window length. Capped by context_length (64)"],
        ["learning_rate", "3e-3", "Step size. The stability knob"],
        ["eval_every", "10", "Logging frequency only. Does not affect the model"]
      ]
    },
    note: "learning_rate is the only knob that behaves differently. The others trade speed against memory; this one trades speed against stability, and it is the only one that can destroy a run outright."
  },
  observe: [
    "max_steps moves the finish line, not the slope. Twenty steps stops early on the same curve; two hundred flattens out once there is nothing left to learn.",
    "learning_rate 0.05 misbehaves — expect oscillation or nan. This is the failure mode worth seeing once on purpose.",
    "learning_rate 0.00003 barely moves the loss, which looks identical to \"not training at all\" from the opposite direction.",
    "Raising block_size reduces the number of training windows on this tiny file, so each step reuses more of the same data.",
    "batch_size 1 gives a noisier curve than batch_size 8 at the same step count, while seeing a quarter as many tokens.",
    "eval_every changes nothing about the result — run it twice with different values and compare the final loss in the run log."
  ],
  exitCheck: [
    "You can compute tokens-per-step from batch_size and block_size.",
    "You have made a run diverge with a high learning rate, on purpose.",
    "You can explain why block_size has a hard ceiling of context_length.",
    "You can name the one knob in the table that cannot change the trained model."
  ],
  Panel: KnobsPanel
};
