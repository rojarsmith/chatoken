# Reference · Troubleshooting

[English](troubleshooting.md) | [繁體中文](troubleshooting.zh-TW.md)

[Course index](../README.md)

Symptoms collected from every stage. Start with the "not actually broken" section — most
early surprises belong there.

## Not actually broken

| What you see | Why it is correct |
| --- | --- |
| Output like `\xc9\x11c` | The untrained model emits random bytes; `ByteTokenizer.decode` shows invalid UTF-8 as escapes. Stage 01, 03 |
| Loss near 5.55 at step 1 | `ln(257)` — a uniform guess over the byte vocabulary. Stage 04 |
| Loss approaching 0 on `every-effort` | Deliberate overfitting on a 4-line dataset. Stage 04 |
| Higher final loss on a bigger dataset | Harder data, more learned. Stage 06 |
| GPT-2 continues your question instead of answering | It is a base model. Stage 08 |
| Model "forgets" after one turn | `random-tiny-byte` has a 64-token context window. Stage 15 |
| Fewer tokens generated than requested | An EOS id was sampled. Stage 03 |
| A cancelled running job takes seconds to stop | Cooperative cancellation. Stage 16 |
| A fresh clone has no checkpoints | `models/` is git-ignored. The course produces them. |

## Environment

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ModuleNotFoundError: llm_core` | Package not installed in the active venv | `.venv\Scripts\activate.bat`, then `python -m pip install -e .` |
| `torch` will not install | Python 3.14 | Use 3.11–3.13; recreate `.venv` |
| `python` resolves outside the project | venv not activated | `python -c "import sys; print(sys.executable)"` must show the project path |
| `UnicodeEncodeError` printing CJK | Console code page is not UTF-8 | `set PYTHONIOENCODING=utf-8` |
| Commands behave oddly | Running in PowerShell or MSYS2 | Use Windows Command Prompt |

## API

| Symptom | Cause | Fix |
| --- | --- | --- |
| Connection refused on 8000 | API not running | `python -m uvicorn apps.api.main:app --reload --port 8000` |
| `422 Unprocessable Entity` | A value is outside the schema range | `max_new_tokens` ≤ 200, `temperature` ≤ 2, `top_k` ≤ 200, `max_steps` ≤ 2000 |
| `Unknown model_id` | Model never loaded, or the API restarted | Loaded models are in memory; reload the checkpoint or GPT-2 |
| `Unknown dataset_id` | Typo, or dataset not prepared | `GET /training/datasets` |
| Browser blocked by CORS | Web origin not allowed | CORS is enabled for local development; check the API base URL |

## Training

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Training text is too short for block_size=N` | Window longer than the dataset | Lower `block_size` or use a larger dataset |
| Loss becomes `nan` | Learning rate too high | Back to `3e-3` for tiny models, `5e-5` for full SFT, `3e-4` for LoRA |
| Loss barely moves | Learning rate too low, or too few steps | Raise one at a time — Stage 05 |
| `Training has no trainable parameters` | Everything frozen, no adapter attached | Check LoRA `target_modules` (`W_query`, `W_value`) |
| CUDA out of memory | Full fine-tuning of GPT-2 | Lower `block_size`, keep `batch_size` 1, or use LoRA |
| Minutes per step | CPU | See [GPU runtime](gpu-runtime.md) |
| Output worse after fine-tuning | Learning rate too high, or too many steps on tiny data | Reload the base model and retry with lower values |

## Datasets and downloads

| Symptom | Cause | Fix |
| --- | --- | --- |
| Dataset `status` is not `ready` | Not downloaded yet | `POST /training/datasets/{id}/prepare` |
| GPT-2 download fails | Network, or Hugging Face unreachable | Retry; the `.complete` marker means partial downloads are not trusted |
| Out of disk space | GPT-2 124M is ~500 MB | Stay on 124M |
| Builder dataset is empty | Never seeded | `POST /training/dataset-builder/seed` |
| Builder examples vanished | `data/custom/` is git-ignored and was cleaned | Re-seed; export anything worth keeping |

## Models and checkpoints

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Unknown checkpoint_id` | Wrong id, or file deleted | `GET /checkpoints` |
| Shape mismatch on load | Model config changed since the file was written | Load with the config stored in the checkpoint |
| `/models` missing a loaded model | Load targeted a different `model_id` | Pass `model_id` explicitly to `POST /models/load` |
| Checkpoint list empty | No training run yet | Do Stage 04 |

## Conversation and streaming

| Symptom | Cause | Fix |
| --- | --- | --- |
| Sessions disappear | In-memory storage, API restarted | By design; Stage 15 |
| Replies ignore history | Context format mismatched to training | `chat-transcript` for chat-tuned, `instruction-request` for instruction-tuned |
| Model answers as the user | Base model without loss masking | Use `gpt2-chat-lora`; Stage 12 |
| Stream arrives all at once | curl buffering | Add `-N` |
| Cancel returns 404 | Job already finished, or wrong id | Poll the job first |

## External providers

| Symptom | Cause | Fix |
| --- | --- | --- |
| Provider shows as not configured | Env vars set after the API started | Set them first, then start uvicorn |
| 401 from the provider | Bad or expired key | Rotate it; never commit it |
| Ollama connection refused | Not running, or wrong base URL | Check port 11434 |
| `top_k` seems ignored | Not sent to OpenAI-compatible endpoints | Expected; see the [external providers track](../tracks/external-models.md) |

## Still stuck

1. `curl -s http://127.0.0.1:8000/health` — is the API up, and on which device?
2. `python -c "import sys; print(sys.executable)"` — is the right Python active?
3. Read the failing job's `status` and `error` fields; they carry the original exception.
4. Re-read the stage's **What to observe** section — the expected value is usually named there.
