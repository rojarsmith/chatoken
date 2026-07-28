# Stage 09 · Prompt format

[English](09-prompt-format.md) | [繁體中文](09-prompt-format.zh-TW.md)

**Part 3 · Reuse** — 17 個階段中的第 9 個 · [課程索引](../README.zh-TW.md)

## Focus

不改任何權重，光改格式就能改變行為。

## Prerequisites

- **Stage 08 · Pretrained GPT-2** — `gpt2-124M` 已載入，而且你已經看過它續寫一道指令、
  而不是遵循它。

## Concept

本階段完全沒有訓練。這裡的一切都發生在推論時，而它把三件容易混淆的事分開：

```
你的訊息
  -> 被 prompt 樣板包裝        ← 本階段，第一部分
  -> 轉換成 token ids          ← Stage 01
  -> 被取樣策略解碼            ← 本階段，第二部分
```

專案內建**四種 prompt 樣板**：

| Style | 呈現形式 |
| --- | --- |
| `raw` | `{message}` — 什麼都不加 |
| `chat` | `User: {message}\nAssistant:` |
| `instruction` | 指令區塊：任務描述、`### Instruction:`、然後 `### Response:` |
| `custom` | 你自己的樣板；必須包含 `{message}` 或 `{instruction}` |

第五個值 `model-default` 會解析成目前載入模型設定中宣告的樣式——`random-tiny-byte` 是 `chat`，
GPT-2 是 `instruction`。這就是為什麼同一個請求在不同模型上行為不同，而你什麼都沒改。

**四種推論模式**把 Stage 03 的旋鈕包裝成具名策略：

| 模式 | 實際設定 | 用來 |
| --- | --- | --- |
| `manual` | 你自己的 `temperature` 與 `top_k` | 直接檢視旋鈕 |
| `greedy` | `temperature=0`、`top_k=null` | 取得可重現的輸出 |
| `focused` | `temperature=0.4`、`top_k=20` | 允許有限的變化 |
| `creative` | `temperature=1.0`、`top_k=80` | 從較寬的候選集合取樣 |

讓這件事變得可教的端點是 `POST /chat/prompt-preview`。它會渲染 prompt 並回報 token 計算，
但**完全不生成任何東西**，所以你能在評斷輸出之前先看清楚輸入面。

本階段誠實的界線：prompt 只是重新分配模型已有的能力。GPT-2 base 被訓練來續寫文字，
沒有任何樣板能把那件事變成遵循指令。Stage 10 會改變權重，那是另一種層級的修法。

## Run it

### 用同一則訊息比較樣板

```cmd
curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"prompt_style\":\"raw\"}"

curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"prompt_style\":\"chat\"}"

curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"prompt_style\":\"instruction\"}"
```

### 寫你自己的樣板

```cmd
curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"prompt_style\":\"custom\",\"prompt_template\":\"Question: {message}\nAnswer:\",\"inference_mode\":\"greedy\"}"
```

### 再用完全相同的請求生成

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32,\"prompt_style\":\"custom\",\"prompt_template\":\"Question: {message}\nAnswer:\",\"inference_mode\":\"greedy\"}"
```

### 比較解碼策略

同一則訊息、同一個樣板、三種模式：

```cmd
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32,\"inference_mode\":\"greedy\"}"
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32,\"inference_mode\":\"focused\"}"
curl -s -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Every effort moves you\",\"model_id\":\"gpt2-124M\",\"max_new_tokens\":32,\"inference_mode\":\"creative\"}"
```

### 在控制台

> 階段階梯會在重整的 Phase 2 出現。在那之前，這位於 legacy 頁籤 **Prompt Lab**。

## What to observe

1. **`prompt_tokens` 會隨樣板重量上升。** `raw` 不花成本；`instruction` 在讀到你的訊息之前
   就先花掉數十個 token。
2. **`effective_prompt_style` 會解析 `model-default`。** 把同一個請求送給 `random-tiny-byte`
   與 `gpt2-124M`，這個欄位不同。
3. **`remaining_context_tokens` 隨樣板變大而縮小。** GPT-2 的 1,024 token 視窗還有空間；
   tiny 模型的 64 沒有，於是 `warnings` 出現。
4. **`prompt` 就是將被 tokenize 的確切文字。** 沒有隱藏的附加內容。逐字對照你的樣板。
5. **`greedy` 每次輸出相同，`creative` 不是。** 相同權重、相同 prompt、不同策略。
6. **沒有任何樣板能讓 GPT-2 回答問題。** 對一個真實請求試試 instruction 樣板，然後誠實地讀結果。
   那個落差就是 Stage 10 的工作。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能用四種樣式渲染同一則訊息，並預測哪個最花 token。
- [ ] 你知道 `model-default` 在每個已載入模型上分別解析成什麼。
- [ ] 你已經寫過自訂樣板，並逐字確認渲染結果。
- [ ] 你能說出 prompt 修不了什麼。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `Prompt template must contain {message} or {instruction}` | 用了 custom 但樣板是純字面文字 | 加入預留位置 |
| `prompt_template is required when prompt_style='custom'` | 設了樣式卻沒給樣板 | 兩個欄位都要送 |
| 每個請求都出現 context 警告 | tiny 模型配上厚重樣板 | 預期行為——64 token 非常少；改用 GPT-2 |
| `top_k` 在預覽中出現卻對外部無效 | 外部供應商忽略 `top_k` | 本地模型會採用；見外部供應商支線 |

## Code map

| 內容 | 位置 |
| --- | --- |
| `BUILT_IN_PROMPT_TEMPLATES`、`prepare_chat_prompt`、`render_prompt_template`、`format_instruction_prompt` | [`generation.py`](../../packages/llm_core/llm_core/generation.py) |
| 模式解析與預覽欄位 | [`chat_service.py`](../../apps/api/services/chat_service.py) → `preview_prompt` |
| `POST /chat/prompt-preview` | [`apps/api/main.py`](../../apps/api/main.py) |
| 各模型的預設樣式 | [`configs.py`](../../packages/llm_core/llm_core/configs.py) → `prompt_style` |

## Next stage

[**Stage 10 · Instruction SFT**](10-instruction-sft.zh-TW.md) — prompt 補不上的落差，
改用權重來補。
