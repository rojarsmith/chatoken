# Stage 07 · Checkpoints

[English](07-checkpoints.md) | [繁體中文](07-checkpoints.zh-TW.md)

**Part 2 · Train** — 17 個階段中的第 7 個 · [課程索引](../README.zh-TW.md)

## Focus

模型是一個帶有血緣的檔案。

## Prerequisites

- **Stage 06 · Data scale** — 你有好幾個訓練好的模型，卻沒有可靠的方式分辨誰是誰。

## Concept

本專案每一次訓練都會在 `models/checkpoints/` 寫出一個 `.pt` 檔。那個檔案就是全部的成果。
打開它，你會看到七樣東西：

```
checkpoint_id      由 model_id 與時間戳產生的唯一 id
model_id           這個模型叫什麼
base_model_id      它是從什麼訓練出來的        ← 血緣
created_at         什麼時候
version            version_id、version_label、lineage、run_config、metrics
model_config       vocab_size、context_length、emb_dim、n_heads、n_layers、…
tokenizer          "byte" 或 "gpt2"
training_summary   losses、tokens_seen、訓練前後樣本
state_dict         模型的每一個權重
```

這個格式有三個性質值得理解。

**它是完整快照，不是差異。** 載入一個 checkpoint 不需要先重播先前的。這與 adapter 或 patch 格式
不同——包括你在 Stage 11 會遇到的 LoRA，那類格式只存與 base model 的差異。Chatoken 會把 LoRA
合併回完整 checkpoint，正是為了讓同一個載入器能處理所有模型。

**它不包含程式碼。** `state_dict` 是一份以層名為鍵的張量字典。重建模型同時需要 `GPTModel`
原始碼*以及*存下來的 `model_config`。改了架構，舊 checkpoint 就載不進來——這就是為什麼設定必須
跟著權重一起走。

**它記錄了自己從哪裡來。** `base_model_id` 加上 `run_config` 回答了「什麼產生了這個？」，
不需要任何外部筆記。這份中繼資料讓 Stage 14 的比較成為可能；一個沒有執行脈絡的 loss 數字
證明不了任何事。

## Run it

### 列出你有什麼

```cmd
curl -s http://127.0.0.1:8000/checkpoints
```

### 載入特定版本作為 chat 模型

```cmd
curl -s -X POST http://127.0.0.1:8000/models/load ^
  -H "Content-Type: application/json" ^
  -d "{\"checkpoint_id\":\"YOUR_CHECKPOINT_ID\",\"model_id\":\"trained-tiny-byte\"}"
```

### 確認它已經在服務中

```cmd
curl -s http://127.0.0.1:8000/models

curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"trained-tiny-byte\",\"max_new_tokens\":24}"
```

### 直接檢視 checkpoint 檔案

```cmd
python -c "import torch; p = torch.load(r'models/checkpoints/YOUR_FILE.pt', map_location='cpu'); print(list(p.keys())); print(p['base_model_id'], p['tokenizer']); print(list(p['state_dict'].keys())[:5])"
```

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 07 · Checkpoints**。

## What to observe

1. **每個 checkpoint 都指出自己的父節點。** Stage 06 的四個模型都回報
   `base_model_id: random-tiny-byte`——同一個父節點、不同的資料。
2. **`run_config` 能還原實驗。** 資料集、`max_steps`、`learning_rate` 都在檔案裡，
   單憑產出物就能重現一次訓練。
3. **`metrics.final_loss` 在階梯上差異明顯**，並且與你訓練時看著捲過去的數字吻合。
4. **`state_dict` 的鍵值就是 Stage 02 的模組樹**：`tok_emb.weight`、`pos_emb.weight`、
   `trf_blocks.0.att.W_query.weight` 等等。這個檔案是架構的直接映像。
5. **先前的 `load_when_complete: true` 自動做了這件事。** 手動做一次，你才看得到那個被隱藏的步驟。
6. **沒有版本中繼資料的舊 checkpoint 仍可載入。** API 會從既有內容推導出備援版本資訊，
   而不是拒絕該檔案。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你不必打開檔案也能列出 checkpoint 包含什麼。
- [ ] 你能說明為什麼沒有相容的模型程式碼，checkpoint 就沒有用。
- [ ] 你已經手動載入過一個 checkpoint 並與它對話。
- [ ] 你能把一個模型回溯到產生它的資料集與設定。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `Unknown checkpoint_id` | id 錯誤，或檔案被刪除 | 重新讀 `GET /checkpoints`；`models/checkpoints/` 被 git 忽略 |
| 載入時形狀不符 | 檔案寫出後模型設定改過 | 用 checkpoint 內存的設定載入，而非目前預設 |
| `/models` 沒有顯示載入的模型 | 載入時指定了不同的 `model_id` | 在 `POST /models/load` 明確傳入 `model_id` |
| checkpoint 清單是空的 | 這份 clone 還沒訓練過 | 先做 Stage 04 |

## Code map

| 內容 | 位置 |
| --- | --- |
| `save_checkpoint`、`load_checkpoint`、`list_checkpoints`、`checkpoint_metadata` | [`checkpoints.py`](../../packages/llm_core/llm_core/checkpoints.py) |
| 版本中繼資料建構 | 同檔案的 `_build_version_metadata` |
| `GET /checkpoints`、`POST /models/load` | [`apps/api/main.py`](../../apps/api/main.py) |
| 檔案落點 | `models/checkpoints/`（被 git 忽略） |

## Next stage

[**Stage 08 · Pretrained GPT-2**](08-pretrained-gpt2.zh-TW.md) — 你已經碰到 136k 參數模型在你這台
機器上的學習天花板。該去借別人的了。
