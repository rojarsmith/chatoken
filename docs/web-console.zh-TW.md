# 最小 Web UI 學習控制台

[English](web-console.md) | [繁體中文](web-console.zh-TW.md)

這份文件說明 LLM ABC 的 Web UI learning console。

這個 console 把小型 Next.js app 接到 FastAPI backend，並把三條學習路徑分清楚：

```text
tiny model -> dataset ladder -> checkpoints
the-verdict -> raw text continuation training
GPT-2 -> instruction prompt -> optional instruction SFT
```

## 新增內容

- `apps/web`：最小 Next.js learning console。
- Chat view：送 prompt 給指定模型。
- From Scratch view：用小型 chat-shaped datasets 訓練 tiny model。
- Raw Text view：用 The Verdict 做較大的 continuation text 訓練。
- GPT-2 view：下載並載入 GPT-2 pretrained weights。
- Instruction view：用 instruction/response data fine-tune GPT-2。
- Experiments view：依 objective、loss、before/after output 比較訓練紀錄。
- Checkpoints view：列出 full checkpoints，並載入成 chat model。
- API CORS：支援本機瀏覽器開發。

## 啟動 API

請使用 Windows Command Prompt，並先啟用 `.venv`：

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

## 啟動 Web UI

開第二個 Windows Command Prompt：

```cmd
cd apps\web
npm install
npm run dev
```

然後打開：

```text
http://127.0.0.1:3000
```

## Learning Flow

1. 打開 Chat，送 `Every effort moves you` 給 `random-tiny-byte`。
2. 打開 From Scratch，跑 `every-effort`，比較 before/after。
3. 打開 Raw Text；UI 應該選到 `the-verdict`，並建議 `random-tiny-byte` 和 `trained-verdict-byte`。
4. 跑 The Verdict job，觀察較大資料上的 raw text continuation。
5. 打開 GPT-2，載入 `GPT-2 small`。
6. 回到 Chat，問一個 instruction-style request，例如 `Explain what a model checkpoint is in one sentence.`
7. 打開 Instruction；UI 應該選到 `instruction-following`，並建議 `gpt2-124M` 和 `gpt2-instruct-finetuned`。
8. 打開 Experiments，比較 raw pretrained GPT-2 和 instruction-tuned GPT-2。

## 為什麼要分開

The Verdict 教模型續寫 raw text。它不是用來教 GPT-2 回答使用者要求。

GPT-2 的 question/request 行為使用 Chapter 7 instruction prompt 格式。更好的 instruction following 來自 `instruction-following` SFT dataset，不是 The Verdict。

資料規模階段請看 [資料規模階梯與訓練實驗記錄](dataset-ladder-experiments.zh-TW.md)。
GPT-2 載入與 instruction prompt 請看 [GPT-2 Pretrained 與 Instruction Prompt](gpt2-pretrained.zh-TW.md)。
