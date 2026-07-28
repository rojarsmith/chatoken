# Stage 03 · Decoding

[English](03-decoding.md) | [繁體中文](03-decoding.zh-TW.md)

**Part 1 · Generate** — 17 個階段中的第 3 個 · [課程索引](../README.zh-TW.md)

## Focus

取樣控制輸出的形狀，但無法增加知識。

## Prerequisites

- **Stage 02 · Forward pass** — 你看過 `(1, 4, 257)` 的 logits 張量，也知道最後一列是模型對
  下一個 token 的意見。

## Concept

一次 forward 給你 257 個分數。生成文字就是重複以下五個步驟，直到 token 夠多：

```
把輸入裁切成最後 context_size 個 id
  -> forward
  -> 取「最後一個位置」的 logits
  -> 從中挑出一個 id        ← 旋鈕唯一作用的地方
  -> 接上去，重複
```

「挑選」這一步就是本階段的全部，而它只有兩個控制項。

**`top_k` 先砍掉候選集合。** 在其他事情發生之前，前 *k* 名以外的 logit 全部被設成 `-inf`，
永遠不可能被選中。`top_k=20` 的意思是「只考慮最好的 20 個，其餘 237 個忽略」。

**`temperature` 決定在剩下的候選中怎麼挑：**

| 設定 | 行為 |
| --- | --- |
| `temperature = 0` | `argmax` — 永遠取最高分。完全確定性。 |
| `0 < t < 1` | logits 除以 `t`，分布被*銳化*，再取樣。 |
| `t = 1` | 直接依原分布取樣。 |
| `t > 1` | 分布被壓平，低機率 token 更容易出現。 |

還有兩個行為在後面很重要：

- **`eos_id` 會提早結束生成。** 若取樣到 id 256，迴圈會在達到 `max_new_tokens` 之前中斷。
  輸出比較短不是 bug。
- **每一步輸入都會裁切成 `context_size`。** 不管對話多長，tiny 模型永遠只看得到最後 64 個 id。
  Stage 15 整章都建立在這個事實上。

本階段最關鍵的觀察是「否定式」的：這些旋鈕都無法改善模型。權重仍然是隨機的。你只是在一個不含
任何資訊的分布裡挑得更講究而已。這正是 Part 2 存在的理由。

## Run it

### 從指令列

確定性基準——跑兩次，位元組層級完全相同：

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24
```

只改長度：

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 8
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 40
```

打開取樣——這個跑兩次再比較：

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24 --temperature 1.0 --top-k 20
```

### 透過 API

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"random-tiny-byte\",\"max_new_tokens\":24,\"temperature\":1.0,\"top_k\":20}"
```

### 在控制台

> 階段階梯會在重整的 Phase 2 出現。在那之前，相同控制項位於 legacy 頁籤 **Chat** 與 **Prompt Lab**。

## What to observe

1. **`temperature=0` 可重現。** 跑兩次輸出完全相同，因為 `argmax` 沒有隨機性。
2. **`temperature=1.0` 不可重現。** 兩次結果不同，但模型完全沒變。
3. **更長不等於更好。** `--max-new-tokens 40` 只是給你更多同樣品質的輸出。長度不是知識。
4. **輸出是 `\xNN` 逸出字元。** 這是 Stage 01 的 `backslashreplace` 在對隨機位元組正常運作——
   模型產生的是合法 token id，只是拼不出合法的 UTF-8。
5. **`tokens_generated` 有時比你要求的少。** 模型取樣到 id 256，迴圈提早結束了。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能預測哪些設定會產生可重現的輸出、哪些不會。
- [ ] 你能說明 `top_k` 是在 `temperature` *之前*做什麼。
- [ ] 你已經用 `temperature 1.0` 跑過同一個指令兩次，並看到兩種結果。
- [ ] 你能用一句話說明為什麼這些都不會讓模型變聰明。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 設了 `--temperature 1.0` 輸出仍相同 | `--top-k 1` 把候選集合壓成一個 | 提高 `top_k` 或不要設它 |
| 輸出非常短 | 取樣到 `eos_id`（256） | 預期行為；重跑或調低 `temperature` |
| `/chat` 回 `422 Unprocessable Entity` | `temperature` 超過 2.0 或 `top_k` 超過 200 | API 有範圍限制；見 `ChatRequest` |

## Code map

| 內容 | 位置 |
| --- | --- |
| 生成迴圈、`top_k` 遮罩、temperature 分支、EOS 中斷 | [`generation.py`](../../packages/llm_core/llm_core/generation.py) → `generate` |
| 生成 id 的位元組解碼 | [`tokenizer.py`](../../packages/llm_core/llm_core/tokenizer.py) → `ByteTokenizer.decode` |
| 請求驗證範圍 | [`apps/api/main.py`](../../apps/api/main.py) → `ChatRequest` |
| CLI 參數 | [`scripts/smoke_chat.py`](../../scripts/smoke_chat.py) |

## Next stage

[**Stage 04 · Training loop**](04-training-loop.zh-TW.md) — 本課程中第一件改變模型、
而不是改變輸出的事。
