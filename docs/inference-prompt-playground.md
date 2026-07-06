# Inference Modes and Prompt Template Playground

[English](inference-prompt-playground.md) | [繁體中文](inference-prompt-playground.zh-TW.md)

This stage isolates inference-time behavior. No weights are trained here. The goal is to make three things visible before a model generates text:

1. The user message is wrapped into a prompt template.
2. The rendered prompt is converted into token ids.
3. The decoding settings decide how the next token is selected.

## Web UI

Open the `Prompt Lab` tab in the Web console.

Use it to compare:

- `Model default`: use the prompt style saved with the selected model checkpoint.
- `Raw text`: send only the message.
- `Chat`: render `User: ...` and `Assistant:`.
- `Instruction`: render the Chapter 7 style instruction/response format.
- `Custom template`: render your own template with `{message}`.

The `Preview` button calls the backend without generating new tokens. It returns the exact rendered prompt, prompt token count, context length, remaining context, and effective inference settings.

The `Generate` button refreshes the preview first, then calls `/chat` with the same request.

## Inference Modes

The backend supports four modes:

| Mode | Effective settings | Learning point |
| --- | --- | --- |
| `manual` | Uses `temperature` and `top_k` from the request. | Directly inspect sampling knobs. |
| `greedy` | `temperature=0`, `top_k=null`. | Always pick the highest-scoring next token. |
| `focused` | `temperature=0.4`, `top_k=20`. | Allow limited variation while keeping outputs constrained. |
| `creative` | `temperature=1.0`, `top_k=80`. | Sample from a wider candidate set. |

For an untrained tiny model, these modes will not create good language. They only change how random or weak logits are decoded. After loading GPT-2 or a trained checkpoint, the same controls become easier to interpret.

## Prompt Preview API

Start the API first:

```cmd
.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

Preview a custom template:

```cmd
curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"random-tiny-byte\",\"max_new_tokens\":24,\"prompt_style\":\"custom\",\"prompt_template\":\"Question: {message}\nAnswer:\",\"inference_mode\":\"greedy\"}"
```

Expected fields:

- `effective_prompt_style`: the style actually used after resolving `model-default`.
- `prompt`: the exact text that will be tokenized.
- `prompt_tokens`: how many tokens the rendered prompt uses.
- `context_length`: model context window.
- `remaining_context_tokens`: how much context is left before generation.
- `temperature` and `top_k`: the effective decoding settings after applying the mode.
- `warnings`: context-window warnings when the prompt plus requested output is too long.

## Generate With the Same Settings

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"random-tiny-byte\",\"max_new_tokens\":24,\"prompt_style\":\"custom\",\"prompt_template\":\"Question: {message}\nAnswer:\",\"inference_mode\":\"greedy\"}"
```

The response includes `prompt_style`, `inference_mode`, `temperature`, and `top_k` so experiment records can show how the answer was generated.

## Suggested Learning Checks

Use the same message for each check:

```text
Every effort moves you
```

1. Compare `raw`, `chat`, and `instruction`. Watch how `prompt_tokens` changes.
2. Switch to `custom` and use `Question: {message}\nAnswer:`. Confirm the rendered prompt is exactly what you expect.
3. Keep the same prompt and compare `greedy`, `focused`, and `creative`.
4. Load GPT-2 small, ask an instruction-style request, then compare `model-default` and `instruction`.
5. Load an instruction fine-tuned checkpoint and repeat the same prompt. The prompt template should now match the way that checkpoint was trained.

This completes the smallest inference playground: the developer can see both the input surface and the decoding policy before judging the model output.
