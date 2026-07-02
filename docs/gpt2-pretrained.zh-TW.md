# GPT-2 Pretrained 與 Instruction Prompt

[English](gpt2-pretrained.md) | [繁體中文](gpt2-pretrained.zh-TW.md)

這一階段要跟參考專案的分線一致：

```text
Chapter 5: the-verdict.txt -> raw text pretraining / continuation
Chapter 7: instruction-data.json -> instruction following fine-tuning
```

`the-verdict.txt` 不是用來把 GPT-2 fine-tune 成助理的資料。它是較大的 raw text dataset，用在從零訓練的資料規模階梯。GPT-2 則是下載 pretrained weights 後，用 Chapter 7 的 instruction prompt 格式來詢問與比較。

## Runtime Files

以下檔案刻意不進 git：

- `models/downloaded/gpt2/...`：GPT-2 config、tokenizer files 與 PyTorch weights。
- `data/external/the-verdict.txt`：較大的 raw text pretraining 資料。
- `data/external/instruction-data.json`：GPT-2 instruction SFT 用的 instruction/response 資料。
- `models/checkpoints/...`：本機 training job 產生的 full checkpoints。

## 啟動 API

請使用 Windows Command Prompt，並先啟用 `.venv`：

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

## 下載並載入 GPT-2

```cmd
for /f %i in ('curl -s -X POST http://127.0.0.1:8000/pretrained/jobs -H "Content-Type: application/json" -d "{\"model_size\":\"124M\",\"model_id\":\"gpt2-124M\"}" ^| python -c "import sys,json; print(json.load(sys.stdin)['job_id'])"') do set GPT2_JOB_ID=%i

curl -s "http://127.0.0.1:8000/pretrained/jobs/%GPT2_JOB_ID%"
```

job 成功後，`gpt2-124M` 會出現在 `/models`。

## 問 GPT-2 一個問題

後端會把 GPT-2 的 prompt 包成 Chapter 7 的 instruction template：

```text
Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
...

### Response:
```

呼叫 `/chat` 時只要送出使用者要求：

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"gpt2-124M\",\"message\":\"Explain what a model checkpoint is in one sentence.\",\"max_new_tokens\":80,\"temperature\":0.8,\"top_k\":50}"
```

raw pretrained GPT-2 本質上是 completion model，不是 instruction-tuned assistant。instruction template 讓輸入格式跟 Chapter 7 fine-tuning 前一致；真正比較會不會聽指令，要看 instruction SFT 前後差異。

## 檢查運算裝置

執行 GPT-2 SFT 前，先確認 API 是否看得到 CUDA：

```cmd
curl -s http://127.0.0.1:8000/health
```

如果回應是 `"device":"cpu"`，GPT-2 SFT 只適合跑很短的 smoke test。實際要在合理時間訓練，請在 `.venv` 安裝 CUDA 版 PyTorch，然後重啟 API。請看 [PyTorch GPU Runtime 設定](gpu-runtime.zh-TW.md)。

## The Verdict 是 Raw Text Training

The Verdict 應該搭配從零開始的小模型：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"the-verdict\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-verdict-byte\",\"max_steps\":320,\"eval_every\":40,\"batch_size\":4,\"block_size\":64,\"learning_rate\":0.003,\"sample_prompt\":\"I had always thought Jack Gisburn\",\"load_when_complete\":true}"
```

這是在較大的文字檔上學 next-token prediction。預期行為是文字續寫，不是問答。

## Instruction Fine-Tuning

`instruction-following` 要在載入 GPT-2 後使用：

先準備本機 instruction dataset：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/datasets/instruction-following/prepare
```

再啟動 SFT job：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-following\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-instruct-finetuned\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.00005,\"sample_prompt\":\"Explain what a model checkpoint is in one sentence.\",\"load_when_complete\":true}"
```

這條路徑才是用來展示 instruction-tuned GPT-2 和 raw pretrained GPT-2 行為差異。
