# Stage 01 · Tokens

[English](01-tokens.md) | [繁體中文](01-tokens.zh-TW.md)

**Part 1 · Generate** — Stage 1 of 17 · [Course index](../README.md)

## Focus

The model never sees your text. It sees a list of integer ids.

## Prerequisites

- The project virtual environment is created and activated, and `pip install -e .` has run.
  See the setup section of the [root README](../../README.md).

This is the first stage. Nothing else is required.

## Concept

A language model is a function over integers. Before any model exists, something must turn
`"Every effort moves you"` into a list of numbers, and turn numbers back into text. That
something is the **tokenizer**, and it is a separate, fixed component — it is not learned
during training.

Chatoken ships two tokenizers, and the difference between them matters later:

| | `ByteTokenizer` | `GPT2Tokenizer` |
| --- | --- | --- |
| Used by | `random-tiny-byte` and everything you train in Part 2 | GPT-2, from Stage 08 onward |
| Rule | one UTF-8 **byte** = one token | byte-pair encoding (BPE), learned merges |
| Vocabulary | 257 | 50,257 |
| EOS id | 256 | 50,256 |
| Needs a download | no | yes (`vocab.json`, `merges.txt`) |

The byte tokenizer is deliberately naive: ids `0..255` are the raw bytes, and id `256` is
reserved for end-of-sequence. Nothing is learned, nothing is downloaded, and every possible
input can be encoded. That makes it the right tool for the first learning loop.

Two consequences to carry forward:

1. **Vocabulary size is a model dimension.** The model's output head produces one score per
   vocabulary entry, so `vocab_size` is literally the width of its last layer. Switching
   tokenizers means switching models.
2. **Decoding can fail.** `ByteTokenizer.decode` uses `errors="backslashreplace"`, so bytes
   that are not valid UTF-8 come back as `\xNN` escapes instead of raising. This is why the
   untrained model's output in Stage 03 looks like escaped garbage: it is not a bug, it is a
   random byte sequence being decoded honestly.

## Run it

### From the command line

Encode a sentence and decode it back:

```cmd
python -c "from llm_core.tokenizer import ByteTokenizer; t = ByteTokenizer(); ids = t.encode('Every effort moves you'); print(len(ids)); print(ids); print(t.decode(ids))"
```

Encode the prompt the chat model actually receives — note that the template adds tokens:

```cmd
python -c "from llm_core.generation import prepare_chat_prompt; from llm_core.tokenizer import ByteTokenizer; p = prepare_chat_prompt('Every effort moves you'); print(repr(p)); print(len(ByteTokenizer().encode(p)))"
```

Encode non-ASCII text, where one character is no longer one token:

```cmd
set PYTHONIOENCODING=utf-8
python -c "from llm_core.tokenizer import ByteTokenizer; print(len(ByteTokenizer().encode('每一分努力')))"
```

### Against the API

With the API running (`python -m uvicorn apps.api.main:app --reload --port 8000`), ask it
how a message becomes a prompt and how many tokens that prompt costs:

```cmd
curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"random-tiny-byte\"}"
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 01 · Tokens** on the ladder. The panel encodes in
the browser using the same one-byte-per-token rule, so the ids update as you type. Press
**Ask the API** to confirm the count against the server's own tokenizer.

## What to observe

1. `Every effort moves you` encodes to **22 tokens** — one per byte, including the 3 spaces.
2. The ids start `[69, 118, 101, 114, 121, 32, ...]`. `69` is `E`, `32` is the space. This is
   ASCII, not something the model chose.
3. Decoding the ids returns the original string exactly. The round trip is lossless.
4. The chat prompt is `'User: Every effort moves you\nAssistant:'`, which is **39 tokens**.
   The template costs 17 tokens before your message is even considered.
5. `每一分努力` — five characters — encodes to **15 tokens**, because each of those characters
   is three UTF-8 bytes. Token count is not character count.
6. `prompt-preview` reports the same `prompt_tokens` count that the model will see, plus any
   context-length warnings.

## Exit check

You may continue when all of these are true:

- [ ] You can state what a tokenizer does without using the word "model".
- [ ] You know why `vocab_size` is 257 and what id 256 is for.
- [ ] You can predict the token count of an ASCII string before running the command.
- [ ] You understand that the prompt template adds tokens to every request.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ModuleNotFoundError: llm_core` | The package is not installed into the active venv | Activate `.venv`, then `python -m pip install -e .` |
| `UnicodeEncodeError` on the CJK example | The Windows console code page is not UTF-8 | `set PYTHONIOENCODING=utf-8` before running, as shown above |
| `prompt-preview` returns 404 | The API is not running | Start uvicorn on port 8000 |

## Code map

| What | Where |
| --- | --- |
| `ByteTokenizer`, `GPT2Tokenizer`, `tokenizer_for_name` | [`packages/llm_core/llm_core/tokenizer.py`](../../packages/llm_core/llm_core/tokenizer.py) |
| Prompt templates and `prepare_chat_prompt` | [`packages/llm_core/llm_core/generation.py`](../../packages/llm_core/llm_core/generation.py) |
| `vocab_size` in the model config | [`packages/llm_core/llm_core/configs.py`](../../packages/llm_core/llm_core/configs.py) |
| `POST /chat/prompt-preview` | [`apps/api/main.py`](../../apps/api/main.py) → `ChatService.preview_prompt` |

## Next stage

[**Stage 02 · Forward pass**](02-forward-pass.md) — how those ids become embeddings, pass
through transformer blocks, and come out as one score per vocabulary entry.
