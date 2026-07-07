# 部署與資源限制

[English](deployment-resource-limits.md) | [繁體中文](deployment-resource-limits.zh-TW.md)

這個階段用來教「可以在我電腦跑」到「可以部署」之間需要看見的限制。

目前目標不是 production hardening，而是理解邊界：

```text
API process -> model memory -> context window -> concurrency -> training jobs
Web process -> API URL -> browser-safe config
External provider -> server-side secrets -> network/rate/cost limits
```

## Web UI

打開 `Deploy` 分頁。

可以檢查：

- `/health` 回報的目前 runtime device
- server-side limits，例如 `chat_max_new_tokens` 和 `training_max_steps`
- model parameter count 與 context length
- 不同 precision 下的粗略 inference memory
- 加入 AdamW state 與 activation 後的粗略 training memory
- context overflow、`block_size > context_length`、local generation serialization 等 warnings

這個 estimator 是教學用估算，不是 profiler。

## API

使用 Windows Command Prompt，並先啟動 `.venv`：

```cmd
.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

讀取 deployment profile：

```cmd
curl -s http://127.0.0.1:8000/deployment/profile
```

估算小型 local inference：

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":1,\"precision\":\"fp32\",\"include_training\":false,\"batch_size\":4,\"block_size\":32}"
```

連 training 一起估：

```cmd
curl -s -X POST http://127.0.0.1:8000/deployment/estimate ^
  -H "Content-Type: application/json" ^
  -d "{\"model_id\":\"random-tiny-byte\",\"prompt_tokens\":32,\"max_new_tokens\":64,\"concurrent_requests\":2,\"precision\":\"fp32\",\"include_training\":true,\"batch_size\":4,\"block_size\":32}"
```

## Estimate 欄位意義

估算會拆成幾個概念：

- `parameter_bytes`：依 precision 計算的模型權重記憶體。
- `kv_cache_like_bytes`：production serving 常見的 key/value cache 概念。
- `local_context_work_bytes`：本教學實作的粗略工作記憶體。
- `attention_scratch_bytes`：attention score memory，會隨 context 平方成長。
- `adamw_training_state_bytes`：訓練時 AdamW optimizer state。
- `activation_estimate_bytes`：粗略 training activation memory。

本專案的 local generation loop 每次會重新計算可見 context。這裡仍然顯示 KV cache，因為 production inference server 通常會做 cache，這是部署時很重要的概念。

## Deployment Shapes

### Local Development

學習時使用：

```cmd
.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

第二個 Command Prompt：

```cmd
cd apps\web
npm install
npm run dev
```

### Split API and Web

建置 Web UI：

```cmd
cd apps\web
npm install
npm run build
npm run start -- --port 3000
```

`NEXT_PUBLIC_API_BASE_URL` 只能放公開 API URL。不要把 provider API key 放在 Web process。

### GPU API Worker

GPT-2 fine-tuning 或較大 checkpoint 應該使用 CUDA。Web UI 可以留在小型 CPU host，但 API worker 應該跑在模型所在的機器。

## 要教會的資源規則

1. `prompt_tokens + max_new_tokens` 必須放得進有效 context window。
2. 更大的 `context_length` 會讓 attention 成本快速增加。
3. 更多 concurrent requests 會成倍增加 context 工作記憶體。
4. training 會比 inference 需要更多記憶體，因為多了 gradients 和 optimizer state。
5. external provider 會降低本地 model memory 壓力，但會增加 network latency、cost 和 rate limits。
6. 目前教學後端只使用一個 training/pretrained job worker，讓行為比較容易觀察。

下一個更接近 production 的階段會是 queue persistence、process supervision、auth、logging 和 real metrics。這些刻意不放進目前的最小部署教學階段。
