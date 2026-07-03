# LoRA / Parameter-Efficient Fine-Tuning

[English](lora-peft.md) | [繁體中文](lora-peft.zh-TW.md)

這一階段在 full instruction SFT 之後，教 parameter-efficient fine-tuning。

目標是展示：模型可以只訓練少量 adapter 參數，而不是更新 GPT-2 的所有權重。

## 本專案實作內容

LLM ABC 在 `packages/llm_core/llm_core/lora.py` 實作最小 LoRA。

訓練流程：

```text
load GPT-2 base
-> freeze base weights
-> replace attention W_query and W_value with LoRA-wrapped linear layers
-> train only LoRA A/B matrices
-> merge LoRA weights back into the base linear layers
-> save a full checkpoint
```

目前 checkpoint 仍然是 merge 後的 full model snapshot，所以既有 checkpoint loader 不需要另外支援 adapter-only 格式就能載入。

## 和 Full SFT 的差異

Full instruction SFT：

```text
all GPT-2 parameters require gradients
```

LoRA：

```text
base GPT-2 parameters are frozen
only low-rank adapter matrices require gradients
```

Web UI 和 experiment record 會顯示：

- `tuning_method`
- `trainable_parameters`
- `total_parameters`
- `trainable_percent`
- LoRA rank、alpha、dropout、target modules

## 用 API 執行

先載入 GPT-2 small 成 `gpt2-124M`，再準備 instruction dataset：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/datasets/instruction-lora/prepare
```

啟動 LoRA job：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"instruction-lora\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-instruct-lora\",\"max_steps\":20,\"eval_every\":5,\"batch_size\":1,\"block_size\":256,\"learning_rate\":0.0003,\"sample_prompt\":\"Explain what a model checkpoint is in one sentence.\",\"load_when_complete\":true}"
```

## 學習檢查點

進入下一階段前，學習者應該能說明：

1. 哪些 GPT-2 權重被 freeze。
2. 哪些 attention layers 加上 LoRA adapters。
3. 為什麼 trainable parameter count 會遠小於 total parameter count。
4. 為什麼這版實作會儲存 merged full checkpoint。
5. 為什麼 LoRA 雖然訓練參數較少，仍然建議使用 CUDA。
