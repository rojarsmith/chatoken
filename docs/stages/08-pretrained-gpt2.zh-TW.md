# Stage 08 · Pretrained GPT-2

[English](08-pretrained-gpt2.md) | [繁體中文](08-pretrained-gpt2.zh-TW.md)

**Part 3 · Reuse** — 17 個階段中的第 8 個 · [課程索引](../README.zh-TW.md)

## Focus

架構完全沒變。算力是別人付的。

## Prerequisites

- **Stage 07 · Checkpoints** — 你已經存下自己訓練的模型，也知道 checkpoint 檔案記錄了什麼：
  權重、設定、tokenizer 名稱與血緣。

走完 Part 2，你有了一個學會幾百個 token 文字的模型。在小模型、小資料、小算力的條件下，
那就是誠實的上限。Part 3 就是你不再付這個代價的地方。

## Concept

這個階段最重要的是注意到「沒有發生什麼事」：沒有人寫新的 model class。GPT-2 是被載入到你從
Stage 02 就一直在用的那個 `GPTModel` 裡。改變的只有設定值。

| | `random-tiny-byte` | `gpt2-124M` |
| --- | --- | --- |
| `vocab_size` | 257 | 50,257 |
| `context_length` | 64 | 1,024 |
| `emb_dim` | 64 | 768 |
| `n_heads` | 4 | 12 |
| `n_layers` | 2 | 12 |
| `qkv_bias` | `False` | `True` |
| `tokenizer` | `byte` | `gpt2` |
| `prompt_style` | `chat` | `instruction` |
| 參數量 | 136,704 | 約 124,000,000 |

也就是在同一份程式碼裡，參數量大約多了 **900 倍**。權重從 `openai-community/gpt2` 下載，
再由 `_load_hf_gpt2_weights` 複製進模組樹中——這個函式把 Hugging Face 的參數名稱對應到本專案的
層名稱。讀懂它，就是「GPT-2」與「你自己寫的模型」是同一個架構最清楚的證明。

隨著權重一起改變的還有兩件事：

**tokenizer。** GPT-2 用的是 BPE，不是位元組。`GPT2Tokenizer` 會優先使用下載附帶的本地
`vocab.json` 與 `merges.txt`，找不到才退回 `tiktoken` 內建的編碼。詞彙量從 257 跳到 50,257，
因此常見單字現在是單一 token，而不是五、六個位元組。

**模型的用途。** GPT-2 是一個 **base** 模型。它被訓練來續寫文字，不是回應請求。你問它問題，
它常常會接著寫出更多問題，因為它的訓練資料長那樣。這不是缺陷，也不是靠更好的 prompt 就能解決的
——這正是 Stage 09 要探究、Stage 10 要補上的那個落差。

## Run it

### 透過 API

啟動下載並載入的任務：

```cmd
curl -s -X POST http://127.0.0.1:8000/pretrained/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"model_size\":\"124M\"}"
```

用回傳的 `job_id` 輪詢：

```cmd
curl -s "http://127.0.0.1:8000/pretrained/jobs/<JOB_ID>"
```

124M 的下載約 500 MB，會放到 `models/downloaded/gpt2/124M/`。只會下載一次；一個 `.complete`
標記檔會讓之後的載入跳過網路。

接著送一個「文字續寫」與一個「請求」，比較它如何處理兩者：

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32}"

curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Explain what a model checkpoint is in one sentence.\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":48}"
```

### 在控制台

> 階段階梯會在重整的 Phase 2 出現。在那之前，相同的操作位於 legacy 頁籤 **GPT-2**。

## What to observe

1. **任務會先回報下載進度，再回報載入進度。** 下載與載入是兩種不同的成本，只有後者會重複發生。
2. **`/models` 現在會同時列出 `gpt2-124M` 與 `random-tiny-byte`。** 兩者由同一個端點、
   同一個 `GPTModel`、同一份生成程式碼提供服務。
3. **第一個 prompt 會產生真正的英文。** 不見得正確，但有單字、有文法、有句子的形狀——
   這些是你的 tiny 模型從來做不到的。
4. **第二個 prompt 不會被回答。** GPT-2 會續寫那段文字，而不是回應那個請求。仔細讀它的輸出；
   這是 Part 3 中最重要的一個觀察。
5. **同一句話的 token 數變少。** BPE 把常見單字壓成一個 token，而 byte tokenizer 需要一個字元一個。
6. **模型設定回報 `prompt_style: instruction`** — GPT-2 的設定預設使用與 tiny 模型不同的 prompt
   樣板。Stage 09 講的正是這件事。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] `gpt2-124M` 出現在 `/models` 中，而且 `/chat` 能得到回應。
- [ ] 你能說出至少四個與 `random-tiny-byte` 不同的設定欄位。
- [ ] 你已經親眼看到 GPT-2 續寫一道指令，而不是遵循它。
- [ ] 你能說明為什麼更大的詞彙量會改變模型的輸出層。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 下載時任務失敗 | 沒有網路，或連不到 Hugging Face | 重試；`.complete` 標記的存在代表下載不完整就不會被信任 |
| 磁碟空間不足 | 124M 約 500 MB，355M 更大 | 清出空間，或就留在 124M——它是本課程建議的尺寸 |
| 生成非常慢 | 在 CPU 上跑 GPT-2 | 當作 smoke test 是可以的。CUDA 設定請見 GPU runtime 參考文件 |
| 輸出不斷重複繞圈 | 對 base 模型使用 greedy 解碼 | 這是預期行為。回頭看 Stage 03 的控制項，然後繼續 Stage 09 |

## Code map

| 內容 | 位置 |
| --- | --- |
| 模型規格（`124M`/`355M`/`774M`/`1558M`） | [`gpt2.py`](../../packages/llm_core/llm_core/gpt2.py) → `GPT2_MODEL_SPECS` |
| 下載、設定轉換、權重對應 | 同檔案的 `download_and_load_gpt2`、`_load_hf_gpt2_weights` |
| BPE tokenizer 與本地資產查找 | [`tokenizer.py`](../../packages/llm_core/llm_core/tokenizer.py) → `GPT2Tokenizer`、`_gpt2_assets_dir` |
| 把載入的模型註冊給 chat 使用 | [`pretrained_service.py`](../../apps/api/services/pretrained_service.py) |
| `POST /pretrained/jobs`、`GET /pretrained/models` | [`apps/api/main.py`](../../apps/api/main.py) |

## Next stage

[**Stage 09 · Prompt format**](09-prompt-format.zh-TW.md) — 同一組權重，分別包進 `raw`、
`chat`、`instruction` 與自訂樣板，看看在還沒做任何訓練之前，行為能改變多少。
