# Reference · API

[English](api.md) | [繁體中文](api.zh-TW.md)

[課程索引](../README.zh-TW.md)

所有端點，依「首次介紹它的階段」分組。本機開發的 base URL 是 `http://127.0.0.1:8000`。
API 執行中時，互動式文件在 `/docs`。

## Runtime

| Method | Path | 階段 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/health` | 安裝 | 裝置、CUDA 可用性、runtime 資訊 |
| `GET` | `/models` | 02 | 本機已載入的模型 |

## Chat 與生成

| Method | Path | 階段 | 用途 |
| --- | --- | --- | --- |
| `POST` | `/chat` | 03 | 同步生成 |
| `POST` | `/chat/prompt-preview` | 01, 09 | 渲染 prompt 並計算 token，不生成 |
| `POST` | `/chat/stream` | 16 | 換行分隔的 JSON token 事件 |
| `POST` | `/chat/jobs` | 16 | 非同步生成任務 |
| `GET` | `/chat/jobs/{job_id}` | 16 | 任務狀態與結果 |
| `POST` | `/chat/jobs/{job_id}/cancel` | 16 | 請求取消 |

`ChatRequest` 主要欄位：`message`、`model_id`、`max_new_tokens`（1–200）、`temperature`
（0–2）、`top_k`（1–200）、`prompt_style`（`model-default` \| `raw` \| `chat` \|
`instruction` \| `custom`）、`prompt_template`、`inference_mode`（`manual` \| `greedy` \|
`focused` \| `creative`）。

## 訓練

| Method | Path | 階段 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/training/datasets` | 06 | 資料集階梯與建議設定 |
| `POST` | `/training/datasets/{id}/prepare` | 06, 10 | 依需求下載資料集 |
| `POST` | `/training/jobs` | 04 | 啟動訓練任務 |
| `GET` | `/training/jobs/{job_id}` | 04 | 狀態、進度事件、摘要 |
| `POST` | `/training/jobs/{job_id}/cancel` | 16 | 合作式取消 |

`TrainingRequest` 主要欄位：`dataset_id`、`base_model_id`、`output_model_id`、`max_steps`
（1–2000）、`batch_size`（1–64）、`block_size`（2–1024）、`learning_rate`、`eval_every`、
`sample_prompt`、`load_when_complete`。

## 你自己建的資料集

| Method | Path | 階段 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/training/dataset-builder` | 13 | 範例與 train/eval 數量 |
| `POST` | `/training/dataset-builder/seed` | 13 | 建立起始範例 |
| `POST` | `/training/dataset-builder/examples` | 13 | 新增範例 |
| `PUT` | `/training/dataset-builder/examples/{id}` | 13 | 更新範例 |
| `DELETE` | `/training/dataset-builder/examples/{id}` | 13 | 刪除範例 |

## Checkpoint 與實驗

| Method | Path | 階段 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/checkpoints` | 07 | 已存的模型版本與血緣 |
| `POST` | `/models/load` | 07 | 把 checkpoint 載入成 chat 模型 |
| `GET` | `/training/experiments` | 14 | 已記錄的訓練執行 |
| `GET` | `/training/experiments/compare` | 14 | 比較兩次執行（`left_id`、`right_id`） |

## Pretrained GPT-2

| Method | Path | 階段 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/pretrained/models` | 08 | 可用的 GPT-2 尺寸與下載狀態 |
| `POST` | `/pretrained/jobs` | 08 | 下載並載入（`model_size`：`124M`…`1558M`） |
| `GET` | `/pretrained/jobs/{job_id}` | 08 | 下載與載入進度 |
| `POST` | `/pretrained/jobs/{job_id}/cancel` | 16 | 取消下載或載入 |

## 會話

| Method | Path | 階段 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/conversations` | 15 | 列出記憶體中的會話 |
| `POST` | `/conversations` | 15 | 建立會話 |
| `GET` | `/conversations/{id}` | 15 | 會話與完整訊息歷史 |
| `DELETE` | `/conversations/{id}` | 15 | 刪除會話 |
| `POST` | `/conversations/{id}/context-preview` | 15 | 渲染後的 context、token 計算、省略項、警告 |
| `POST` | `/conversations/{id}/messages` | 15 | 送出一輪並生成回覆 |

會話欄位：`system_prompt`、`context_format`（`chat-transcript` \|
`instruction-request`）、`max_history_messages`、`context_token_budget`，
以及一般的生成設定。

## 部署

| Method | Path | 階段 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/deployment/profile` | 17 | 執行裝置與伺服器限制 |
| `POST` | `/deployment/estimate` | 17 | 依精度與併發數估算記憶體 |

伺服器限制：`chat_max_new_tokens` 200、`external_chat_max_new_tokens` 2,000、
`training_max_steps` 2,000。

## 外部供應商

| Method | Path | 支線 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/external/models` | T1 | 已設定的供應商插槽 |
| `POST` | `/external/prompt-preview` | T1 | 確切的外送供應商內容 |
| `POST` | `/external/chat` | T1 | 在伺服器端呼叫供應商 |

憑證來自 API 行程讀取的環境變數：`CHATOKEN_EXTERNAL_OPENAI_API_KEY`、
`CHATOKEN_EXTERNAL_OPENAI_MODEL`、`CHATOKEN_EXTERNAL_OPENAI_BASE_URL`、
`CHATOKEN_EXTERNAL_OLLAMA_ENABLED`、`CHATOKEN_EXTERNAL_OLLAMA_MODEL`、
`CHATOKEN_EXTERNAL_OLLAMA_BASE_URL`。它們永遠不會抵達瀏覽器。

## 任務生命週期

Chat、training、pretrained 三種任務共用同一個狀態機：

```
queued -> running -> succeeded
              |  \
              |   -> failed      （記錄 error）
              +-> cancelled      （合作式；見 Stage 16）
```

取消 `queued` 的任務會立即生效。取消 `running` 的任務會在下一個安全檢查點生效。
