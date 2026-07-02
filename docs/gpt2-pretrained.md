# GPT-2 Pretrained and Instruction Prompts

[English](gpt2-pretrained.md) | [繁體中文](gpt2-pretrained.zh-TW.md)

This stage follows the reference project split:

```text
Chapter 5: the-verdict.txt -> raw text pretraining / continuation
Chapter 7: instruction-data.json -> instruction following fine-tuning
```

`the-verdict.txt` is not used to fine-tune GPT-2 into an assistant. It is a larger raw text dataset for the from-scratch training ladder. GPT-2 is loaded from downloaded pretrained weights, then queried with the same instruction prompt format used in Chapter 7.

## Runtime Files

Downloaded files are ignored by git:

- `models/downloaded/gpt2/...`: GPT-2 config, tokenizer files, and PyTorch weights.
- `data/external/the-verdict.txt`: larger raw text for text pretraining.
- `data/external/instruction-data.json`: instruction/response data for GPT-2 instruction SFT.
- `models/checkpoints/...`: full checkpoints created by local training jobs.

## Start the API

Use Windows Command Prompt with `.venv` activated:

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

## Download and Load GPT-2

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/pretrained/jobs -H "Content-Type: application/json" -d "{\"model_size\":\"124M\",\"model_id\":\"gpt2-124M\"}" ^| python -c "import sys,json; print(json.load(sys.stdin)['job_id'])"') do set GPT2_JOB_ID=%i

curl -s "http://127.0.0.1:8000/pretrained/jobs/%GPT2_JOB_ID%"
```

When the job succeeds, `gpt2-124M` appears in `/models`.

## Ask GPT-2 a Question

The backend wraps GPT-2 prompts with the Chapter 7 instruction template:

```text
Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
...

### Response:
```

Call `/chat` with the plain user request:

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"gpt2-124M\",\"message\":\"Explain what a model checkpoint is in one sentence.\",\"max_new_tokens\":80,\"temperature\":0.8,\"top_k\":50}"
```

Raw pretrained GPT-2 is a completion model, not an instruction-tuned assistant. The instruction template gives it the same input shape used before Chapter 7 fine-tuning, but good instruction following comes from the instruction SFT dataset.

## Check Runtime Device

Before running GPT-2 SFT, check whether the API sees CUDA:

```cmd
curl -s http://127.0.0.1:8000/health
```

If the response says `"device":"cpu"`, keep GPT-2 SFT to a very short smoke test. For a practical run, install a CUDA-enabled PyTorch build in `.venv` and restart the API. See [GPU Runtime Setup for PyTorch](gpu-runtime.md).

## The Verdict Is Raw Text Training

Use The Verdict with the tiny from-scratch model:

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"the-verdict\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-verdict-byte\",\"max_steps\":320,\"eval_every\":40,\"batch_size\":4,\"block_size\":64,\"learning_rate\":0.003,\"sample_prompt\":\"I had always thought Jack Gisburn\",\"load_when_complete\":true}"
```

This teaches raw next-token prediction on a larger text file. The expected behavior is continuation, not question answering.

## Instruction Fine-Tuning

Use `instruction-following` only after loading GPT-2:

Prepare the local instruction dataset first:

```cmd
curl -s -X POST http://127.0.0.1:8000/training/datasets/instruction-following/prepare
```

Then start the SFT job:

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-following\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-instruct-finetuned\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.00005,\"sample_prompt\":\"Explain what a model checkpoint is in one sentence.\",\"load_when_complete\":true}"
```

This is the path that demonstrates why an instruction-tuned GPT-2 behaves differently from a raw pretrained GPT-2.
