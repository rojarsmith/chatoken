# Stage 06 · Data scale

[English](06-data-scale.md) | [繁體中文](06-data-scale.zh-TW.md)

**Part 2 · Train** — 17 個階段中的第 6 個 · [課程索引](../README.zh-TW.md)

## Focus

好資料勝過更多步數。

## Prerequisites

- **Stage 05 · Training knobs** — 你已經把 `max_steps` 與 `learning_rate` 推來推去，
  並發現兩者都無法在 `every-effort` 上做出更好的模型。

## Concept

Stage 04 把過擬合當成成功。這個階段，它不再是了。

`every-effort` 是同樣兩行重複四次。能重現它的模型學到的是查表，不是語言。要突破這個天花板，
唯一的方法是更多、更多樣的資料，所以本專案提供一條由四個資料集組成、依序爬升的階梯：

| 資料集 | Tier | 建議步數 | Block | Prompt style | 新增了什麼 |
| --- | --- | --- | --- | --- | --- |
| `every-effort` | tiny | 80 | 32 | `chat` | 你已經跑過的基準 |
| `every-effort-expanded` | small | 140 | 32 | `chat` | 同樣形狀但更多變化 |
| `learning-dialogues` | medium | 220 | 32 | `chat` | 樣本多到能稍微泛化 |
| `the-verdict` | larger | 320 | 64 | `raw` | 真正的散文，以及不同的目標 |

前三個是 chat 形狀：`User: ... / Assistant: ...`。`the-verdict` 的不同之處比它的大小更重要——
它是 **raw text**，以 `prompt_style: raw`、目標 `raw-text` 訓練。沒有 user、也沒有 assistant。
模型學的是續寫散文，而那正是 pretraining。

不要期待 `the-verdict` 會讓模型回答問題。續寫與遵循指令是從不同資料學來的不同能力；
這個區別正是 Part 3 與 Part 4 存在的全部理由。

每個資料集也各自帶著自己的 prompt：

- `comparison_prompt` — 用於訓練前後樣本，讓比較公平。
- `dataset_probe_prompt` — 一句代表該資料集的詞句，用來探測行為。

對 `the-verdict` 來說兩者都是 `I had always thought Jack Gisburn`，因為問一個續寫模型
「什麼是 checkpoint？」什麼也告訴不了你。

`the-verdict` 會依需求下載到 `data/external/`，該目錄被 git 忽略。

## Run it

### 準備資料集

```cmd
curl -s http://127.0.0.1:8000/training/datasets
curl -s -X POST http://127.0.0.1:8000/training/datasets/the-verdict/prepare
```

### 爬階梯

每次執行都使用該資料集的建議設定與自己的 output model id：

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"every-effort-expanded\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-small-byte\",\"max_steps\":140,\"eval_every\":20,\"load_when_complete\":true}"

curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"learning-dialogues\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-medium-byte\",\"max_steps\":220,\"eval_every\":20,\"load_when_complete\":true}"
```

### 在 The Verdict 上做 raw text 訓練

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"the-verdict\",\"base_model_id\":\"random-tiny-byte\",\"output_model_id\":\"trained-verdict-byte\",\"max_steps\":320,\"eval_every\":40,\"batch_size\":4,\"block_size\":64,\"learning_rate\":0.003,\"sample_prompt\":\"I had always thought Jack Gisburn\",\"load_when_complete\":true}"
```

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 06 · Data scale**。

## What to observe

1. **越往上爬，最終 loss 反而*變高*。** `every-effort` 趨近於零；`the-verdict` 差得遠。
   在更難的資料上得到更高的 loss 是進步，不是退步。
2. **樣本會先變糟再變好。** 背下來的文字看起來很流暢；一個 136k 參數的模型真正學到的東西看起來
   很粗糙。相信資料集，不要相信漂亮。
3. **`the-verdict` 的輸出會續寫散文。** 送 `I had always thought Jack Gisburn`，模型會繼續寫。
   送一個問題，它也會繼續寫——它根本沒有「被提問」這個概念。
4. **The Verdict 的 `block_size` 提高到 64**，而且不能再高：那是 Stage 05 提到的 tiny 模型
   `context_length` 上限。
5. **同一個 base model 產生了四個不同的 checkpoint。** `random-tiny-byte` 是四者共同的父節點；
   Stage 07 就是在讀這份血緣。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你已經在階梯上至少三個級別訓練過。
- [ ] 你能說明為什麼更高的最終 loss 可能代表更好的實驗。
- [ ] 你能說出 `chat` 與 `raw` 兩種 prompt style 的差異。
- [ ] 你能說明為什麼 The Verdict 不會讓模型學會遵循指令。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 資料集 `status` 不是 `ready` | 檔案還沒下載 | `POST /training/datasets/{id}/prepare` |
| 下載失敗 | 沒有網路 | The Verdict 與 instruction 資料都是依需求抓取；重試 |
| `Training text is too short for block_size=64` | 在小資料集上用了 64 | 64 是給 The Verdict 的；較小級別維持 32 |
| Verdict 輸出重複 | 小模型在困難資料上用 greedy 解碼 | 回頭調 Stage 03 的旋鈕；這裡的天花板是模型大小 |

## Code map

| 內容 | 位置 |
| --- | --- |
| 四個資料集規格與建議設定 | [`training_service.py`](../../apps/api/services/training_service.py) |
| 依需求下載 | 同檔案的 `prepare_dataset` |
| 資料檔案 | `data/tiny/`、`data/small/`、`data/medium/`、`data/external/` |
| `GET /training/datasets`、`POST /training/datasets/{id}/prepare` | [`apps/api/main.py`](../../apps/api/main.py) |

## Next stage

[**Stage 07 · Checkpoints**](07-checkpoints.zh-TW.md) — 你現在有四個訓練好的模型。
半年後你要怎麼分辨它們？
