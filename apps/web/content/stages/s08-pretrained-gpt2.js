import PretrainedPanel from "../../components/panels/PretrainedPanel";

export default {
  concept: {
    paragraphs: [
      "The most important thing to notice in this stage is what does not happen: no new model class is written. GPT-2 is loaded into the exact GPTModel you have used since Stage 02. Only the config numbers change.",
      "Two things change alongside the weights. The tokenizer becomes BPE, so the vocabulary jumps from 257 to 50,257 and common words become single tokens. And the purpose changes: GPT-2 is a base model, trained to continue text, not to answer requests."
    ],
    note: "Ask it a question and it will often continue with more questions, because that is what its training data looked like. This is not a defect, and better prompting alone does not fix it — it is the exact gap Stage 09 explores and Stage 10 closes."
  },
  observe: [
    "The job reports download progress, then load progress. Downloading and loading are two different costs; only the second one repeats.",
    "The loaded model reports 163,037,184 parameters, not 124M. Hugging Face ties GPT-2's output head to its token embedding; this project keeps a separate out_head, which adds 768 × 50,257 = 38,597,376. Same weights, different bookkeeping.",
    "The model list now shows gpt2-124M next to random-tiny-byte. Both are served by the same endpoint, the same GPTModel, and the same generation code.",
    "A continuation prompt produces real English — words, grammar, sentence shape — none of which your tiny model ever produced.",
    "A request is not answered. GPT-2 continues the text instead of responding to it. This is the single most important observation in Part 3.",
    "Token counts drop for the same sentence, because BPE packs common words into one token where the byte tokenizer needed one per character.",
    "The model config reports prompt_style instruction — GPT-2 defaults to a different template than the tiny model, which is what Stage 09 is about."
  ],
  exitCheck: [
    "gpt2-124M appears in the model list and answers a chat request.",
    "You can name at least four config fields that differ from random-tiny-byte.",
    "You have seen GPT-2 continue an instruction instead of following it.",
    "You can explain why a bigger vocabulary changes the model's output layer."
  ],
  Panel: PretrainedPanel
};
