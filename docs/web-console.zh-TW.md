# 最小 Web UI 學習控制台

[English](web-console.md) | [繁體中文](web-console.zh-TW.md)

這份文件說明 LLM ABC 的 Web UI learning console。

這個 console 把小型 Next.js app 接到 FastAPI backend，並把三條學習路徑分清楚：

```text
tiny model -> dataset ladder -> checkpoints
the-verdict -> raw text continuation training
GPT-2 -> instruction prompt -> optional instruction SFT
GPT-2 -> frozen base -> LoRA adapters -> merged checkpoint
custom instruction examples -> train/eval split -> custom SFT
checkpoint versions -> experiment comparison -> model selection
streamed tokens -> cancel running jobs -> responsive UI
```

## 新增內容

- `apps/web`：最小 Next.js learning console。
- GPT Model view：檢視本機 GPTModel 從 token ids 到 logits 的建立順序。
- Training Config view：學習 TrainingConfig 參數如何改變訓練迴圈。
- Chat view：從指定模型串流 token events，並可取消目前 stream。
- From Scratch view：用小型 chat-shaped datasets 訓練 tiny model。
- Raw Text view：用 The Verdict 做較大的 continuation text 訓練。
- GPT-2 view：下載並載入 GPT-2 pretrained weights。
- Instruction view：準備 instruction data、載入 GPT-2，然後用 instruction/response examples fine-tune。
- LoRA view：freeze GPT-2，訓練 low-rank adapters，然後儲存 merged checkpoint。
- Dataset Builder view：建立本機 instruction examples，切分 train/eval，然後訓練 custom SFT。
- Experiments view：依 version、objective、loss delta、before/after output 比較訓練紀錄。
- Checkpoints view：檢視 model versions、lineage、training config，並載入成 chat model。
- streaming chat、training jobs、GPT-2 load/download jobs 都有 Cancel controls。
- API CORS：支援本機瀏覽器開發。

## 啟動 API

請使用 Windows Command Prompt，並先啟用 `.venv`：

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

檢查目前運算裝置：

```cmd
curl -s http://127.0.0.1:8000/health
```

Web UI 頂部會顯示同一份 runtime 資訊。CPU 可以用來跑 tiny from-scratch 學習階段；GPT-2 instruction SFT 若要在合理時間完成，應該使用 CUDA。CPU 只建議當成很短的 smoke test。設定步驟請看 [PyTorch GPU Runtime 設定](gpu-runtime.zh-TW.md)。

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

1. 打開 GPT Model，檢視本機 `GPTModel` 到 logits 的實作路徑。
2. 打開 Training Config，調整 `max_steps`、`batch_size`、`block_size`、`learning_rate`、`eval_every`。
3. 打開 Chat，送 `Every effort moves you` 給 `random-tiny-byte`。
4. 打開 From Scratch，跑 `every-effort`，比較 before/after。
5. 打開 Raw Text；UI 應該選到 `the-verdict`，並建議 `random-tiny-byte` 和 `trained-verdict-byte`。
6. 跑 The Verdict job，觀察較大資料上的 raw text continuation。
7. 打開 GPT-2，載入 `GPT-2 small`。
8. 回到 Chat，問一個 instruction-style request，例如 `Explain what a model checkpoint is in one sentence.`
9. 打開 Instruction；UI 應該選到 `instruction-following`，並顯示三步驟閉環：instruction data、GPT-2 base、instruction SFT。
10. 如果 instruction data 還不存在，按 `Download dataset`。面板接著應該顯示一筆 dataset example 和格式化後的 Chapter 7 model input。
11. 載入 `GPT-2 small`，執行 instruction SFT，然後比較 `Before (raw GPT-2)` 和 `After (instruction SFT)`。
12. 打開 LoRA；UI 應該選到 `instruction-lora`，並顯示 LoRA adapter training。
13. 執行 LoRA，並比較 trainable parameter percentage 和 full instruction SFT 的差異。
14. 打開 Dataset Builder；檢視種子資料，新增一筆 `train` 範例與一筆 `eval` 範例。
15. 使用 `instruction-builder` 執行 custom SFT，並比較 `Before (GPT-2 base)` 與 `After (custom SFT)`。
16. 打開 Experiments，比較 raw pretrained GPT-2、full SFT、LoRA 和 custom SFT。
17. 先讀 comparison summary，再讀 generated samples。
18. 打開 Checkpoints，檢視 model version lineage 並載入指定版本。
19. 回到 Chat，送出 streaming request，並在到達 `max_new_tokens` 前取消。

## 為什麼要分開

The Verdict 教模型續寫 raw text。它不是用來教 GPT-2 回答使用者要求。

GPT-2 的 question/request 行為使用 Chapter 7 instruction prompt 格式。更好的 instruction following 來自 `instruction-following` SFT dataset，不是 The Verdict。

資料規模階段請看 [資料規模階梯與訓練實驗記錄](dataset-ladder-experiments.zh-TW.md)。
基礎原理階段請看 [模型基礎原理](model-foundations.zh-TW.md)。
GPT-2 載入與 instruction prompt 請看 [GPT-2 Pretrained 與 Instruction Prompt](gpt2-pretrained.zh-TW.md)。
LoRA 請看 [LoRA / Parameter-Efficient Fine-Tuning](lora-peft.zh-TW.md)。
Dataset Builder 請看 [訓練資料管理與 Dataset Builder](dataset-builder.zh-TW.md)。
模型版本請看 [模型版本與實驗比較強化](model-version-experiment-comparison.zh-TW.md)。
Streaming 與取消任務請看 [Streaming Chat 與取消任務](streaming-chat-cancel.zh-TW.md)。
GPU 設定請看 [PyTorch GPU Runtime 設定](gpu-runtime.zh-TW.md)。
