import TokenizerPanel from "../../components/panels/TokenizerPanel";

export default {
  concept: {
    paragraphs: [
      "A language model is a function over integers. Before any model exists, something must turn \"Every effort moves you\" into a list of numbers, and turn numbers back into text. That something is the tokenizer, and it is a separate, fixed component — it is not learned during training.",
      "The byte tokenizer is deliberately naive: ids 0..255 are the raw bytes and id 256 is reserved for end-of-sequence. Nothing is learned, nothing is downloaded, and every possible input can be encoded."
    ],
    table: {
      head: ["", "ByteTokenizer", "GPT2Tokenizer"],
      rows: [
        ["Rule", "one UTF-8 byte = one token", "byte-pair encoding, learned merges"],
        ["Vocabulary", "257", "50,257"],
        ["EOS id", "256", "50,256"],
        ["Needs a download", "no", "yes (vocab.json, merges.txt)"]
      ]
    },
    note: "Two consequences to carry forward. Vocabulary size is a model dimension — the output head is literally as wide as the vocabulary, so switching tokenizers means switching models. And decoding can fail: bytes that are not valid UTF-8 come back as \\xNN escapes rather than raising, which is why Stage 03's untrained output looks like garbage."
  },
  observe: [
    "\"Every effort moves you\" encodes to 22 tokens — one per byte, including the 3 spaces.",
    "The ids start [69, 118, 101, 114, 121, 32, …]. 69 is E and 32 is the space. This is ASCII, not something the model chose.",
    "Decoding the ids returns the original string exactly. The round trip is lossless.",
    "The chat prompt costs 39 tokens for the same message — the template adds 17 before your text is even considered.",
    "每一分努力 — five characters — encodes to 15 tokens, because each is three UTF-8 bytes. Token count is not character count.",
    "The API's prompt_tokens matches the count computed here in the browser, because both implement the same byte rule."
  ],
  exitCheck: [
    "You can state what a tokenizer does without using the word \"model\".",
    "You know why vocab_size is 257 and what id 256 is for.",
    "You can predict the token count of an ASCII string before running it.",
    "You understand that the prompt template adds tokens to every request."
  ],
  Panel: TokenizerPanel
};
