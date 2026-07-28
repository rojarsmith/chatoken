# Stage 12 · Chat SFT

[English](12-chat-sft.md) | [繁體中文](12-chat-sft.zh-TW.md)

**Part 4 · Align** — 17 個階段中的第 12 個 · [課程索引](../README.zh-TW.md)

## Focus

多輪逐字稿教會輪流發話——而且 loss 只應該涵蓋助理說的話。

## Prerequisites

- **Stage 11 · LoRA** — 你會凍結 base 模型並訓練 adapter，也理解為什麼結果會存成完整 checkpoint。

## Concept

Stage 10 教的是單輪回答：一道指令進去，一則回應出來。對話需要更多——模型必須讀取一段*歷史*，
然後只產生下一個助理輪次。

`chat-sft-lora` 資料集存放多輪逐字稿。`ChatTranscriptDataset` 會把每份逐字稿拆成
（prompt, response）配對，prompt 是目前為止說過的一切，response 是下一則助理訊息。

新觀念在於「目標」發生了什麼事：

```
tokens:   System: ... User: ... Assistant:   A nice reply here
targets:  -100  -100  -100  -100  -100  -100  A  nice  reply  here  <eos>
          └────────── 被忽略 ──────────┘     └──── loss 生效 ────┘
```

prompt 位置被設成 `-100`，而 PyTorch 的 `cross_entropy` 會跳過它。**模型永遠不會因為預測出
使用者的話而被獎勵。** 沒有這個遮罩，模型會把大部分能力用在學習產生像樣的使用者輪次——
而那正是你在 Stage 08 看到的 base GPT-2 失敗模式：問它問題，它產生更多問題。

其餘配方沿用 Stage 11，但設定更重：

| 設定 | Stage 11（instruction） | Stage 12（chat） |
| --- | --- | --- |
| `max_steps` | 20 | 240 |
| `block_size` | 256 | 384 |
| `learning_rate` | 3e-4 | 3e-4 |
| 目標 | `instruction-lora` | `chat-lora` |
| Prompt style | `instruction` | `chat` |
| 輸出 | `gpt2-instruct-lora` | `gpt2-chat-lora` |

更長的視窗才裝得下數輪歷史。更大的步數則反映目標更難：輪次結構要被學會，不只是答案形狀。

另外注意截斷策略。當逐字稿太長時，prompt token 會從*前面*被丟棄，而 response 被保留。
舊歷史是可拋棄的；正在被學習的東西不是。

## Run it

強烈建議使用 CUDA。在 CPU 上跑 240 步 GPT-2 的 forward 與 backward 會等非常久。

```cmd
curl -s http://127.0.0.1:8000/health
```

### 訓練

```cmd
curl -s -X POST http://127.0.0.1:8000/training/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"dataset_id\":\"chat-sft-lora\",\"base_model_id\":\"gpt2-124M\",\"output_model_id\":\"gpt2-chat-lora\",\"max_steps\":240,\"eval_every\":10,\"batch_size\":1,\"block_size\":384,\"learning_rate\":0.0003,\"sample_prompt\":\"who are you?\",\"load_when_complete\":true}"
```

### 在真實會話中測試

用 chat transcript 格式建立會話：

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Chat LoRA smoke\",\"model_id\":\"gpt2-chat-lora\",\"system_prompt\":\"You are Chatoken, a concise assistant for a learning console.\",\"max_history_messages\":8,\"context_token_budget\":512,\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

用回傳的 `conversation_id` 先送出一個事實，再問回來：

```cmd
curl -s -X POST http://127.0.0.1:8000/conversations/<CONVERSATION_ID>/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"My name is Rojar. Please remember it.\",\"model_id\":\"gpt2-chat-lora\",\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"

curl -s -X POST http://127.0.0.1:8000/conversations/<CONVERSATION_ID>/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"What is my name?\",\"model_id\":\"gpt2-chat-lora\",\"context_format\":\"chat-transcript\",\"max_new_tokens\":80,\"temperature\":0,\"inference_mode\":\"greedy\"}"
```

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 12 · Chat SFT**。

## What to observe

1. **它不再自問自答。** 用相同的會話格式跟 base GPT-2 比較一下。這就是 loss 遮罩的效果。
2. **它能從脈絡回答。** 「What is my name?」之所以答得出來，是因為那個事實在渲染出來的逐字稿裡
   ——不是因為模型把它存在哪裡。
3. **240 步是 Stage 10 的 12 倍，換來的行為進步卻更小。** 輪次結構比答案形狀更難學。
4. **它仍然答不好許多開放式問題。** 幾百份逐字稿配上 124M base，是一個示範，不是一個產品。
   把這句話說出來；這是誠實的解讀。
5. **`training_objective: chat-lora` 與 `prompt_style: chat` 都被記錄下來**，
   所以 Stage 14 不會拿它跟 instruction 的執行相比。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能說明 `-100` 在目標張量中的作用，以及它為什麼重要。
- [ ] 你能說明為什麼 prompt token 是從前面截斷，而不是後面。
- [ ] 你已經進行過一次兩輪會話，第二個回答依賴第一輪的內容。
- [ ] 你能誠實說出這個 checkpoint 能做什麼、不能做什麼。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `Chat dataset has no assistant responses to train on` | 逐字稿項目缺少助理輪次 | 檢查 `data/chat/chat-sft-mini.json` 的結構 |
| 訓練跑了好幾小時 | CPU | 改用 CUDA；見 GPU runtime 參考文件 |
| 回覆忽略會話歷史 | `context_format` 是 `instruction-request` 而非 `chat-transcript` | 對齊模型訓練時使用的格式 |
| 模型以使用者身分回答 | loss 遮罩未生效，或用到了 base 模型 | 確認 `model_id` 是 `gpt2-chat-lora` |
| 重啟後會話消失 | 會話存在記憶體中 | 預期行為；見 Stage 15 |

## Code map

| 內容 | 位置 |
| --- | --- |
| 配對抽取、`-100` 遮罩、前端截斷 | [`training.py`](../../packages/llm_core/llm_core/training.py) → `ChatTranscriptDataset` |
| 逐字稿渲染 | [`generation.py`](../../packages/llm_core/llm_core/generation.py) → `format_chat_transcript` |
| 資料集規格 | [`training_service.py`](../../apps/api/services/training_service.py) → `chat-sft-lora` |
| 訓練資料 | `data/chat/chat-sft-mini.json` |

## Next stage

[**Stage 13 · Your own dataset**](13-your-own-dataset.zh-TW.md) — 到目前為止的資料集都是別人給的。
現在換你自己寫一個。
