import DatasetBuilderPanel from "../../components/panels/DatasetBuilderPanel";

export default {
  concept: {
    paragraphs: [
      "Every dataset so far arrived ready-made. In real work that never happens: the data is the part you own, and it is where most of the quality comes from.",
      "The split field carries the new idea. A model that has seen an example can reproduce it, which tells you nothing about whether it learned anything general. Held-out examples are the only data that can answer that question — and they only work if they are held out before you look at the results."
    ],
    flow: `instruction example -> train/eval split -> prompt template -> SFT loop -> checkpoint`,
    note: "Examples do not teach the model by existing in a file. Only the ones the training reader selects become gradient updates. data/custom/ is git-ignored — it is your local experiment data."
  },
  observe: [
    "The train and eval counts are reported separately. Only the train count affects training.",
    "Adding one example changes the trained model. With a dataset this small, individual examples are visible in the output — instructive, and a warning.",
    "Your phrasing propagates. Write terse outputs and you get terse answers; the model copies style as readily as content.",
    "The eval example exposes the gap. Trained instructions come back well; the held-out one usually does not. That difference is the only honest signal you have.",
    "dataset_id instruction-builder is recorded, so Stage 14 knows these runs are not comparable with the stock dataset.",
    "The same instruction template from Stage 09 is used — your data enters the same pipeline, with nothing special about the format."
  ],
  exitCheck: [
    "You have added, edited, and deleted an example.",
    "You can explain why eval examples must not be trained on.",
    "You have trained on your own examples and tested one held-out instruction.",
    "You can explain why a small dataset makes each example unusually influential."
  ],
  Panel: DatasetBuilderPanel
};
