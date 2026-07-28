# Stage 03 · Decoding

[English](03-decoding.md) | [繁體中文](03-decoding.zh-TW.md)

**Part 1 · Generate** — Stage 3 of 17 · [Course index](../README.md)

## Focus

Sampling controls the shape of the output. It cannot add knowledge.

## Prerequisites

- **Stage 02 · Forward pass** — you have seen a `(1, 4, 257)` logits tensor and you know the
  last row is the model's opinion about the next token.

## Concept

One forward pass gives you 257 scores. Generating text means repeating a five-step loop until
you have enough tokens:

```
crop input to the last context_size ids
  -> forward pass
  -> take the logits at the LAST position
  -> pick one id from them        ← the only place the knobs act
  -> append and repeat
```

The picking step is the whole lesson, and it has exactly two controls.

**`top_k` truncates the candidate set.** Before anything else, every logit outside the top *k*
is set to `-inf`, so it can never be chosen. `top_k=20` means "consider the 20 best options
and ignore the other 237".

**`temperature` decides how to choose among what is left:**

| Setting | Behavior |
| --- | --- |
| `temperature = 0` | `argmax` — always the single highest score. Fully deterministic. |
| `0 < t < 1` | Logits are divided by `t`, which *sharpens* the distribution, then sampled. |
| `t = 1` | Sample from the distribution as-is. |
| `t > 1` | Flattens the distribution, making unlikely tokens more likely. |

Two more behaviors matter later:

- **`eos_id` stops generation early.** If the sampled id is 256, the loop breaks before
  `max_new_tokens` is reached. A short answer is not a bug.
- **The input is cropped to `context_size` every step.** The tiny model only ever sees the last
  64 ids, no matter how long the conversation gets. Stage 15 is built entirely on this fact.

The critical observation in this stage is negative: none of these knobs improve the model.
The weights are still random. You are choosing more carefully from a distribution that has no
information in it. That is why Part 2 exists.

## Run it

### From the command line

Deterministic baseline — run it twice, byte for byte identical:

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24
```

Change only the length:

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 8
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 40
```

Turn on sampling — run this twice and compare:

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24 --temperature 1.0 --top-k 20
```

### Against the API

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"random-tiny-byte\",\"max_new_tokens\":24,\"temperature\":1.0,\"top_k\":20}"
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 03 · Decoding**. Each button sends the **same
request twice** and reports whether the two replies came back identical — the fastest way to see
which settings are deterministic and which are not.

## What to observe

1. **`temperature=0` is reproducible.** Two runs produce identical output. There is no
   randomness in `argmax`.
2. **`temperature=1.0` is not.** Two runs differ. The model did not change between them.
3. **Longer is not better.** `--max-new-tokens 40` gives you more output of exactly the same
   quality. Length is not knowledge.
4. **The output is `\xNN` escapes.** This is Stage 01's `backslashreplace` decoding doing its
   job on random bytes — the model is producing valid token ids that do not form valid UTF-8.
5. **`tokens_generated` is sometimes less than you asked for.** The model sampled id 256 and
   the loop stopped early.

## Exit check

You may continue when all of these are true:

- [ ] You can predict which settings give reproducible output and which do not.
- [ ] You can explain what `top_k` does *before* `temperature` is applied.
- [ ] You have run the same command twice at `temperature 1.0` and seen two different results.
- [ ] You can state, in one sentence, why none of this makes the model smarter.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Output identical despite `--temperature 1.0` | `--top-k 1` collapses the candidate set to one | Raise `top_k` or leave it unset |
| Very short output | An `eos_id` (256) was sampled | Expected; rerun or lower `temperature` |
| `422 Unprocessable Entity` from `/chat` | `temperature` above 2.0 or `top_k` above 200 | The API clamps ranges; see `ChatRequest` |

## Code map

| What | Where |
| --- | --- |
| The generation loop, `top_k` mask, temperature branch, EOS break | [`generation.py`](../../packages/llm_core/llm_core/generation.py) → `generate` |
| Byte decoding of generated ids | [`tokenizer.py`](../../packages/llm_core/llm_core/tokenizer.py) → `ByteTokenizer.decode` |
| Request validation ranges | [`apps/api/main.py`](../../apps/api/main.py) → `ChatRequest` |
| CLI flags | [`scripts/smoke_chat.py`](../../scripts/smoke_chat.py) |

## Next stage

[**Stage 04 · Training loop**](04-training-loop.md) — the first thing in this course that
changes the model instead of the output.
