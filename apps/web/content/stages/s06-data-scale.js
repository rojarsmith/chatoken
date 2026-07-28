import DatasetLadderPanel from "../../components/panels/DatasetLadderPanel";

export default {
  concept: {
    paragraphs: [
      "Stage 04 called overfitting a success. This is the stage where it stops being one. A model that reproduces every-effort has learned a lookup table, not a language.",
      "The first three rungs are chat-shaped. the-verdict is different in a way that matters more than its size: it is raw text, trained with prompt_style raw and the objective raw-text. There is no user and no assistant — the model learns to continue prose, which is what pretraining is."
    ],
    table: {
      head: ["Dataset", "Tier", "Steps", "Block", "What it adds"],
      rows: [
        ["every-effort", "tiny", "80", "32", "The baseline you already ran"],
        ["every-effort-expanded", "small", "140", "32", "More variety in the same shape"],
        ["learning-dialogues", "medium", "220", "32", "Enough examples to generalize a little"],
        ["the-verdict", "larger", "320", "64", "Real prose, and a different objective"]
      ]
    },
    note: "Do not expect the-verdict to make the model answer questions. Continuation and instruction following are different skills learned from different data — the reason Part 3 and Part 4 exist."
  },
  observe: [
    "Final loss goes up as you climb. every-effort approaches zero; the-verdict does not come close. Higher loss on harder data is progress, not regression.",
    "The samples get worse before they get better. Memorized text looks fluent; genuinely learned text from a 136k-parameter model looks rough.",
    "the-verdict output continues prose. Send it a question and it will keep writing — it has no notion of being asked anything.",
    "block_size rises to 64 for The Verdict and cannot go higher: that is the tiny model's context_length ceiling from Stage 05.",
    "The same base model produces four different checkpoints, all with random-tiny-byte as their parent."
  ],
  exitCheck: [
    "You have trained on at least three rungs of the ladder.",
    "You can explain why a higher final loss can indicate a better experiment.",
    "You can state the difference between the chat and raw prompt styles.",
    "You can explain why The Verdict will not make a model follow instructions."
  ],
  Panel: DatasetLadderPanel
};
