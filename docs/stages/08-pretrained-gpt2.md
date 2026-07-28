# Stage 08 · Pretrained GPT-2

[English](08-pretrained-gpt2.md) | [繁體中文](08-pretrained-gpt2.zh-TW.md)

**Part 3 · Reuse** — Stage 8 of 17 · [Course index](../README.md)

## Focus

The architecture does not change. Someone else already paid for the training.

## Prerequisites

- **Stage 07 · Checkpoints** — you have saved a model you trained yourself, and you know what
  a checkpoint file records: weights, config, tokenizer name, and lineage.

By the end of Part 2 you had a model that learned a few hundred tokens of text. That is the
honest ceiling of a tiny model on a tiny dataset with a tiny compute budget. Part 3 is where
you stop paying that cost.

## Concept

The most important thing to notice in this stage is what *doesn't* happen: no new model class
is written. GPT-2 is loaded into the exact `GPTModel` you have been using since Stage 02.
Only the config numbers change.

| | `random-tiny-byte` | `gpt2-124M` |
| --- | --- | --- |
| `vocab_size` | 257 | 50,257 |
| `context_length` | 64 | 1,024 |
| `emb_dim` | 64 | 768 |
| `n_heads` | 4 | 12 |
| `n_layers` | 2 | 12 |
| `qkv_bias` | `False` | `True` |
| `tokenizer` | `byte` | `gpt2` |
| `prompt_style` | `chat` | `instruction` |
| Parameters | 136,704 | ~124,000,000 |

That is roughly **900× more parameters** in the same code. The weights are downloaded from
`openai-community/gpt2` and copied into the module tree by `_load_hf_gpt2_weights`, which maps
Hugging Face's parameter names onto this project's layer names. Reading that function is the
clearest available proof that "GPT-2" and "the model you wrote" are the same architecture.

Two things change alongside the weights:

**The tokenizer.** GPT-2 uses BPE, not bytes. `GPT2Tokenizer` prefers the local `vocab.json`
and `merges.txt` that come with the download and falls back to `tiktoken`'s bundled encoding.
The vocabulary jumps from 257 to 50,257, so common words are now single tokens rather than
five or six bytes.

**What the model is for.** GPT-2 is a **base** model. It was trained to continue text, not to
answer requests. Ask it a question and it will often continue with more questions, because
that is what its training data looked like. This is not a defect and it is not fixed by better
prompting alone — it is the exact gap that Stage 09 explores and Stage 10 closes.

## Run it

### Against the API

Start a download-and-load job:

```cmd
curl -s -X POST http://127.0.0.1:8000/pretrained/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"model_size\":\"124M\"}"
```

Poll it with the returned `job_id`:

```cmd
curl -s "http://127.0.0.1:8000/pretrained/jobs/<JOB_ID>"
```

The 124M download is roughly 500 MB and lands in `models/downloaded/gpt2/124M/`. It is
downloaded once; a `.complete` marker makes later loads skip the network.

Then send a text continuation and a request, and compare how it handles each:

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32}"

curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":48}"
```

### In the console

> The stage ladder ships in Phase 2 of the restructure. Until then the same controls live in
> the legacy console tab **GPT-2**.

## What to observe

1. **The job reports download progress, then load progress.** Downloading and loading are two
   different costs; only the second one repeats.
2. **`/models` now lists `gpt2-124M`** next to `random-tiny-byte`. Both are served by the same
   endpoint, the same `GPTModel`, and the same generation code.
3. **The first prompt produces real English.** Not correct English necessarily, but words,
   grammar, and sentence shape — none of which your tiny model ever produced.
4. **The second prompt is not answered.** GPT-2 continues the text instead of responding to
   the request. Read its output carefully; this is the single most important observation in
   Part 3.
5. **Token counts drop for the same sentence.** BPE packs common words into one token where
   the byte tokenizer needed one per character.
6. **The model config reports `prompt_style: instruction`** — GPT-2 configs default to a
   different prompt template than the tiny model. Stage 09 is about exactly that.

## Exit check

You may continue when all of these are true:

- [ ] `gpt2-124M` appears in `/models` and answers `/chat`.
- [ ] You can name at least four config fields that differ from `random-tiny-byte`.
- [ ] You have seen GPT-2 continue an instruction instead of following it.
- [ ] You can explain why a bigger vocabulary changes the model's output layer.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Job fails while downloading | No network access, or Hugging Face unreachable | Retry; the `.complete` marker means partial downloads are not trusted |
| Out of disk space | 124M is ~500 MB; 355M is larger | Free space, or stay on 124M — it is the recommended size for this course |
| Generation is very slow | Running GPT-2 on CPU | Fine for a smoke test. See the GPU runtime reference for CUDA setup |
| Output is repetitive loops | Greedy decoding on a base model | Expected. Revisit the Stage 03 controls, then continue to Stage 09 |

## Code map

| What | Where |
| --- | --- |
| Model specs (`124M`/`355M`/`774M`/`1558M`) | [`gpt2.py`](../../packages/llm_core/llm_core/gpt2.py) → `GPT2_MODEL_SPECS` |
| Download, config translation, weight mapping | `download_and_load_gpt2`, `_load_hf_gpt2_weights` in the same file |
| BPE tokenizer and local asset lookup | [`tokenizer.py`](../../packages/llm_core/llm_core/tokenizer.py) → `GPT2Tokenizer`, `_gpt2_assets_dir` |
| Registering the loaded model for chat | [`pretrained_service.py`](../../apps/api/services/pretrained_service.py) |
| `POST /pretrained/jobs`, `GET /pretrained/models` | [`apps/api/main.py`](../../apps/api/main.py) |

## Next stage

[**Stage 09 · Prompt format**](09-prompt-format.md) — the same weights, wrapped in `raw`,
`chat`, `instruction`, and custom templates, to see how much behavior changes before any
training happens.
