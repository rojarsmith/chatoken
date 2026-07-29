# Stage 09 · Prompt format

[English](09-prompt-format.md) | [繁體中文](09-prompt-format.zh-TW.md)

**Part 3 · Reuse** — Stage 9 of 17 · [Course index](../README.md)

## Focus

Formatting changes behavior with zero weight change.

## Prerequisites

- **Stage 08 · Pretrained GPT-2** — `gpt2-124M` is loaded, and you have watched it continue an
  instruction instead of following it.

## Concept

No training happens in this stage. Everything here is inference-time, and it separates three
things that are easy to confuse:

```
your message
  -> wrapped by a prompt template     ← this stage, part 1
  -> converted to token ids           ← Stage 01
  -> decoded by a sampling policy     ← this stage, part 2
```

**Four prompt templates** ship with the project:

| Style | Rendered form |
| --- | --- |
| `raw` | `{message}` — nothing added |
| `chat` | `User: {message}\nAssistant:` |
| `instruction` | The instruction block: a task description, `### Instruction:`, then `### Response:` |
| `custom` | Your own template; must contain `{message}` or `{instruction}` |

A fifth value, `model-default`, resolves to whatever the loaded model's config declares —
`chat` for `random-tiny-byte`, `instruction` for GPT-2. This is why the same request behaves
differently against different models without you changing anything.

**Four inference modes** bundle the Stage 03 knobs into named policies:

| Mode | Effective settings | Use it to |
| --- | --- | --- |
| `manual` | your `temperature` and `top_k` | inspect the knobs directly |
| `greedy` | `temperature=0`, `top_k=null` | get reproducible output |
| `focused` | `temperature=0.4`, `top_k=20` | allow limited variation |
| `creative` | `temperature=1.0`, `top_k=80` | sample from a wide candidate set |

The endpoint that makes this teachable is `POST /chat/prompt-preview`. It renders the prompt
and reports the token math **without generating anything**, so you can see the input surface
before judging the output.

The honest limit of this stage: prompting redistributes the ability a model already has. GPT-2
base was trained to continue text, and no template converts that into instruction following.
Stage 10 changes the weights, and that is a different kind of fix.

## Run it

### Compare templates on the same message

```cmd
curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"prompt_style\":\"raw\"}"

curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"prompt_style\":\"chat\"}"

curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"prompt_style\":\"instruction\"}"
```

### Write your own template

```cmd
curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"prompt_style\":\"custom\",\"prompt_template\":\"Question: {message}\nAnswer:\",\"inference_mode\":\"greedy\"}"
```

### Then generate with the identical request

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32,\"prompt_style\":\"custom\",\"prompt_template\":\"Question: {message}\nAnswer:\",\"inference_mode\":\"greedy\"}"
```

### Compare decoding policies

Same message, same template, three modes:

```cmd
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32,\"inference_mode\":\"greedy\"}"
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32,\"inference_mode\":\"focused\"}"
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32,\"inference_mode\":\"creative\"}"
```

### In the console

Open `http://127.0.0.1:3000` and pick **Stage 09 · Prompt format** on the ladder.

## What to observe

1. **`prompt_tokens` rises with template weight.** `raw` costs nothing; `instruction` costs
   several dozen tokens before your message is read.
2. **`effective_prompt_style` resolves `model-default`.** Send the same request to
   `random-tiny-byte` and `gpt2-124M` and this field differs.
3. **`remaining_context_tokens` shrinks as the template grows.** With GPT-2's 1,024-token
   window there is room; with the tiny model's 64 there is not, and `warnings` appears.
4. **`prompt` is the exact text that will be tokenized.** No hidden additions. Compare it
   against your template character by character.
5. **`greedy` output is identical across runs; `creative` is not.** Same weights, same prompt,
   different policy.
6. **None of the templates make GPT-2 answer the question.** Try the instruction template on a
   real request and read the result honestly. That gap is Stage 10's job.

## Exit check

You may continue when all of these are true:

- [ ] You can render the same message in all four styles and predict which costs most tokens.
- [ ] You know what `model-default` resolves to for each loaded model.
- [ ] You have written a custom template and confirmed the rendered prompt exactly.
- [ ] You can state what prompting cannot fix.

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Prompt template must contain {message} or {instruction}` | Custom style with a literal template | Include the placeholder |
| `prompt_template is required when prompt_style='custom'` | Style set, template missing | Send both fields |
| Context warnings on every request | Tiny model, heavy template | Expected — 64 tokens is very little; use GPT-2 |
| `top_k` appears in preview but changes nothing externally | External providers ignore `top_k` | Local models honor it; see the External providers track |

## Code map

| What | Where |
| --- | --- |
| `BUILT_IN_PROMPT_TEMPLATES`, `prepare_chat_prompt`, `render_prompt_template`, `format_instruction_prompt` | [`generation.py`](../../packages/llm_core/llm_core/generation.py) |
| Mode resolution and preview fields | [`chat_service.py`](../../apps/api/services/chat_service.py) → `preview_prompt` |
| `POST /chat/prompt-preview` | [`chat.py`](../../apps/api/routers/chat.py) |
| Per-model default style | [`configs.py`](../../packages/llm_core/llm_core/configs.py) → `prompt_style` |

## Next stage

[**Stage 10 · Instruction SFT**](10-instruction-sft.md) — the gap prompting could not close,
closed by changing weights.
