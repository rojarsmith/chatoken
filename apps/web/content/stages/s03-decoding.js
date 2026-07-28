import DecodingPanel from "../../components/panels/DecodingPanel";

export default {
  concept: {
    paragraphs: [
      "One forward pass gives you 257 scores. Generating text means repeating a five-step loop until you have enough tokens. The picking step is the whole lesson, and it has exactly two controls."
    ],
    flow: `crop input to the last context_size ids
  -> forward pass
  -> take the logits at the LAST position
  -> pick one id from them        ← the only place the knobs act
  -> append and repeat`,
    table: {
      head: ["Setting", "Behavior"],
      rows: [
        ["top_k", "Every logit outside the top k is set to -inf before anything else, so it can never be chosen."],
        ["temperature = 0", "argmax — always the single highest score. Fully deterministic."],
        ["0 < t < 1", "Logits are divided by t, which sharpens the distribution, then sampled."],
        ["t > 1", "Flattens the distribution, making unlikely tokens more likely."]
      ]
    },
    note: "The critical observation in this stage is negative: none of these knobs improve the model. The weights are still random. You are choosing more carefully from a distribution that has no information in it — which is why Part 2 exists."
  },
  observe: [
    "temperature 0 is reproducible: the two runs are byte-for-byte identical, because argmax has no randomness.",
    "temperature 1.0 is not: the two runs differ, and the model did not change between them.",
    "Longer is not better. Raising max new tokens gives you more output of exactly the same quality.",
    "The output is \\xNN escapes — Stage 01's backslashreplace decoding doing its job on random bytes.",
    "tokens_generated is sometimes less than requested: the model sampled id 256 and the loop stopped early.",
    "With top_k 1, even temperature 1.0 becomes deterministic — the candidate set collapsed to one."
  ],
  exitCheck: [
    "You can predict which settings give reproducible output and which do not.",
    "You can explain what top_k does before temperature is applied.",
    "You have run the same request twice at temperature 1.0 and seen two different results.",
    "You can state, in one sentence, why none of this makes the model smarter."
  ],
  Panel: DecodingPanel
};
