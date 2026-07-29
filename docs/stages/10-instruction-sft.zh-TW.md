# Stage 10 · Instruction SFT

[English](10-instruction-sft.md) | [繁體中文](10-instruction-sft.zh-TW.md)

**Part 4 · Align** — 17 個階段中的第 10 個 · [課程索引](../README.zh-TW.md)

## Focus

用（指令, 回應）配對訓練，才會讓模型回答問題。

## Prerequisites

- **Stage 09 · Prompt format** — 你已經在 GPT-2 上試過所有樣板，並確認沒有一個能把續寫模型
  變成助理。
- 從這裡開始強烈建議使用 CUDA。見 [GPU runtime 參考文件](../reference/gpu-runtime.zh-TW.md)。

## Concept

Part 2 的一切都在純文字上訓練：目標就是檔案中的下一個 token。監督式微調改變的是*文字內容*，
不是迴圈的運作方式。

`instruction-following` 資料集是一串長這樣的範例：

```json
{ "instruction": "...", "input": "", "output": "..." }
```

`InstructionDataset` 用你在 Stage 09 見過的同一個 instruction 樣板，把每一筆渲染成單一訓練字串：

```
Below is an instruction that describes a task. Write a response that
appropriately completes the request.

### Instruction:
{instruction}

### Response:
{output}
```

然後就照 Stage 04 訓練 `every-effort` 的方式訓練這個字串——下一個 token 預測、cross-entropy、
AdamW。**機制完全沒變。** 改變的是這些文字現在示範了你想要的行為：在 `### Response:` 之後，
接著的是一個答案。

這就是 instruction tuning 的全部概念。模型學到的不是「服從」，而是「這種特定的 prompt 形狀之後，
會接著某種特定的補完」。

與 Part 2 的兩個實務差異：

**learning rate 大約降低 60 倍**，從 `3e-3` 降到 `5e-5`。你在調整一個已經能用的模型，
不是從雜訊裡打造一個。在這裡用大步伐會破壞既有能力——這個失敗模式有名字，叫做災難性遺忘
（catastrophic forgetting），而高 learning rate 是通往它最快的路。

**每一個參數都可訓練。** 全部約 1.24 億個權重都會拿到梯度，而且 AdamW 還要替每個參數保留兩份
狀態。那個記憶體成本正是 Stage 11 存在的動機。

## Run it

### 準備資料集

```cmd
curl -s -X POST http://127.0.0.1:8000/training/datasets/instruction-following/prepare
```

### 長時間執行前先確認 runtime

```cmd
curl -s http://127.0.0.1:8000/health
```

若 `device` 是 `cpu`，請把 `max_steps` 壓到很小，並把這次執行當成 smoke test。

### 記錄「之前」的回答

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":80,\"inference_mode\":\"focused\"}"
```

### 微調

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-following\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-instruct-finetuned\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.00005,\"sample_prompt\":\"Explain what a model checkpoint is in one sentence.\",\"load_when_complete\":true}"
```

### 再問一次同樣的問題

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-instruct-finetuned\",\"max_new_tokens\":80,\"inference_mode\":\"focused\"}"
```

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 10 · Instruction SFT**。

## What to observe

1. **訓練前後那組對照就是本階段的全部。** base GPT-2 續寫；微調後的模型嘗試回答。
   在看任何數字之前，先把兩者完整讀完。
2. **20 步就足以明顯改變行為。** 對齊是一種比 pretraining 小得多的介入。
3. **`batch_size` 是 1、`block_size` 是 256。** instruction 範例很長，而 1.24 億參數的完整微調
   又很吃記憶體——兩個限制往同一個方向推。
4. **品質仍然很差。** 幾百筆範例加上 20 步，產生的是答案的*形狀*，不是好答案。這個區別值得多想一下。
5. **訓練摘要回報 `training_objective: instruction-sft`。** Stage 14 會用這個欄位拒絕不公平的比較。
6. **留意記憶體。** 在 CPU 上很慢；在小 GPU 上可能根本放不下。那個數字就是下一階段的論據。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能說明相對於 Stage 04 改變了什麼——以及沒有改變什麼。
- [ ] 你能說明為什麼 learning rate 比 Part 2 小約 60 倍。
- [ ] 你有同一個 prompt 的訓練前後對照，並且保存下來了。
- [ ] 你能說出促成 LoRA 的那個資源成本。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 資料集 `status` 不是 `ready` | instruction 資料還沒下載 | `POST /training/datasets/instruction-following/prepare` |
| CUDA out of memory | 1.24 億參數的完整微調 | 調低 `block_size`、`batch_size` 維持 1，或直接跳到 Stage 11 |
| 微調後輸出反而*變差* | learning rate 太高，或在小資料上步數太多 | 回到 `5e-5`；重新載入 `gpt2-124M` 再試 |
| 每步要好幾分鐘 | 在 CPU 上執行 | 預期行為。安裝 CUDA PyTorch 並重啟 API |
| `Unknown base_model_id: gpt2-124M` | GPT-2 未載入，或 API 重啟過 | 重做 Stage 08 的載入任務 |

## Code map

| 內容 | 位置 |
| --- | --- |
| instruction 範例渲染 | [`training.py`](../../packages/llm_core/llm_core/training.py) → `InstructionDataset` |
| instruction 樣板 | [`generation.py`](../../packages/llm_core/llm_core/generation.py) → `format_instruction_prompt` |
| 資料集規格與建議設定 | [`dataset_registry.py`](../../apps/api/services/dataset_registry.py) → `instruction-following` |
| `POST /training/jobs` | [`training.py`](../../apps/api/routers/training.py) |

## Next stage

[**Stage 11 · LoRA**](11-lora.zh-TW.md) — 同樣的行為改變，但只訓練約百分之一的參數。
