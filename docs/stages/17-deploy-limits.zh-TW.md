# Stage 17 · Deploy & limits

[English](17-deploy-limits.md) | [繁體中文](17-deploy-limits.zh-TW.md)

**Part 5 · Ship** — 17 個階段中的第 17 個 · [課程索引](../README.zh-TW.md)

## Focus

成本是 context 長度 × 併發數。

## Prerequisites

- **Stage 16 · Streaming & cancel** — 系統對「一個人坐在電腦前」是可行的。
  這個階段問的是：當那個前提不成立時會怎樣。

## Concept

到目前為止的一切都假設一台機器、一個使用者。部署主要就是在處理「這個假設消失後什麼會壞」——
答案是記憶體，分成四個不同的池子：

| 池子 | 隨什麼成長 | 說明 |
| --- | --- | --- |
| `parameter_bytes` | 模型大小 × 精度 | 每個已載入模型固定。fp16 可減半。 |
| `kv_cache_like_bytes` | context × 併發數 | 正式伺服器會為每個請求快取的東西 |
| `attention_scratch_bytes` | context 的**平方** | 最容易讓人意外的那一個 |
| `adamw_training_state_bytes` | 可訓練參數 × 2 | 只在訓練時存在 |

權重只付一次。其餘全部是**每個併發請求各付一份**，這就是為什麼一個單獨跑得很順的模型，
在同一台機器上遇到十個使用者就會垮掉。

attention scratch 值得特別強調。分數是每個 query 對每個 key 都算，所以成本隨 context 長度的
平方成長。視窗加倍，這個池子大約變成四倍。「把 context 調大一點就好」從來不是免費的。

關於這份實作的一個誠實說明：本地生成迴圈**每產生一個 token 就重算一次可見的 context**，
而不是快取 key 與 value。估算器仍然回報 `kv_cache_like_bytes`，因為快取是真實推論伺服器的作法，
而知道那個成本的形狀，比精準對應這個教學迴圈更重要。

伺服器也透過 `GET /deployment/profile` 公布自己的護欄：

| 限制 | 數值 |
| --- | --- |
| `chat_max_new_tokens` | 200 |
| `external_chat_max_new_tokens` | 2,000 |
| `training_max_steps` | 2,000 |

而且它同時只跑**一個**訓練／pretrained worker——這是刻意的，好讓學習過程中行為維持可觀察。

由此衍生出三種部署形狀：

**本機開發。** API 與 web 在同一台機器，都在 127.0.0.1 上。到目前為止都是這樣。

**API 與 web 分離。** 建置 web app，並把 `NEXT_PUBLIC_API_BASE_URL` 指向公開的 API URL。
任何以 `NEXT_PUBLIC_` 開頭的值都會被送進瀏覽器——供應商 API key 絕不能存在 web 行程裡。
它們屬於 API 伺服器，而外部供應商支線正是這樣接的。

**GPU API worker。** web app 可以放在小台的 CPU 主機上；API 必須跑在模型所在的地方。
模型權重不會跑到前端去。

## Run it

### 讀取執行環境概況

```cmd
curl -s http://127.0.0.1:8000/deployment/profile
```

### 估算一個小型單一請求

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":1,\"precision\":\"fp32\",\"include_training\":false,\"batch_size\":4,\"block_size\":32}"
```

### 一次只改一個維度

併發 ×8：

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate -H "Content-Type: application/json" -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":8,\"precision\":\"fp32\",\"include_training\":false,\"batch_size\":4,\"block_size\":32}"
```

context ×2——注意 scratch 池：

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate -H "Content-Type: application/json" -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":64,\"max_new_tokens\":128,\"concurrent_requests\":1,\"precision\":\"fp32\",\"include_training\":false,\"batch_size\":4,\"block_size\":32}"
```

加上訓練：

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate -H "Content-Type: application/json" -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":2,\"precision\":\"fp32\",\"include_training\":true,\"batch_size\":4,\"block_size\":32}"
```

### 改用 GPT-2 估算

把 `"model_id"` 換成 `"gpt2-124M"` 再跑一次，逐項比較每個池子。

### 為分離式部署建置 web app

```cmd
cd apps\web
npm install
npm run build
npm run start -- --port 3000
```

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 17 · Deploy & limits**。

## What to observe

1. **併發會把權重以外的一切乘上去。** 參數池是平的；其餘隨請求數線性成長。
2. **context 加倍不只讓總量加倍。** 找到 `attention_scratch_bytes`，親自確認那個平方成長。
3. **訓練的成本遠高於推論。** 梯度加上每個參數兩份 AdamW 狀態，再加上 activation。
4. **fp16 只會讓參數池減半，其他不變。** 精度不是萬用折扣。
5. **警告會在真正的錯誤上觸發** — `prompt_tokens + max_new_tokens` 超過 context 視窗，
   或 `block_size > context_length`，也就是 Stage 05 的同一個限制。
6. **估算器是教學工具，不是 profiler。** 它給你成本的形狀與哪個維度佔主導。
   真正的容量規劃需要實測。

## Exit check

以下全部成立時，課程就完成了：

- [ ] 你能說出哪個記憶體池隨 context 長度的平方成長。
- [ ] 你能說明為什麼權重只付一次、而 context 是每個請求各付一份。
- [ ] 你知道為什麼供應商 API key 絕不能進入 web 行程。
- [ ] 你能描述三種部署形狀以及各自適用的時機。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 估算結果大到不可思議 | 併發與 context 相乘 | 這正是課題；調低其中一個再估一次 |
| web app 連不到 API | `NEXT_PUBLIC_API_BASE_URL` 未設或錯誤 | 在 `npm run build` 之前設成公開 API URL |
| 正式環境 CUDA out of memory 但本機不會 | 是併發，不是模型大小 | 限制併發請求數，或限制 context |
| `block_size > context_length` 警告 | 訓練視窗比模型視窗寬 | 調低 `block_size`；見 Stage 05 |

## Code map

| 內容 | 位置 |
| --- | --- |
| Profile、限制與所有估算池 | [`deployment_service.py`](../../apps/api/services/deployment_service.py) |
| `GET /deployment/profile`、`POST /deployment/estimate` | [`deployment.py`](../../apps/api/routers/deployment.py) |
| Web 端 API base URL | `apps/web/.env.example` → `NEXT_PUBLIC_API_BASE_URL` |
| 裝置選擇 | service 層的 `torch.cuda.is_available()` |

## 接下來

你已經走完整條路徑：token、模型、訓練、checkpoint、pretrained 權重、prompt、instruction tuning、
LoRA、chat tuning、你自己的資料、評估、會話、串流與部署形狀。

兩個選修方向：

- [**外部供應商**](../tracks/external-models.zh-TW.md) — 把你做的東西拿去和代管模型比較。
- [**參考資料**](../README.zh-TW.md#參考資料) — 名詞表、API 參考與架構地圖。
