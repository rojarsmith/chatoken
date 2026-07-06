# 推論模式與 Prompt Template Playground

[English](inference-prompt-playground.md) | [繁體中文](inference-prompt-playground.zh-TW.md)

這個階段專門拆開 inference time 的行為。這裡不訓練權重，目標是讓模型產生文字前的三件事看得見：

1. 使用者輸入的 message 會先被包進 prompt template。
2. rendered prompt 會被轉成 token ids。
3. decoding 設定會決定下一個 token 如何被選出來。

## Web UI

打開 Web console 的 `Prompt Lab` 分頁。

可以比較：

- `Model default`：使用模型 checkpoint 內保存的 prompt style。
- `Raw text`：只送 message 本身。
- `Chat`：包成 `User: ...` 和 `Assistant:`。
- `Instruction`：包成 Chapter 7 風格的 instruction/response 格式。
- `Custom template`：用自己的 template 渲染 `{message}`。

`Preview` 只呼叫後端渲染 prompt，不產生新 token。它會回傳實際 prompt、prompt token 數、context length、剩餘 context，以及套用後的 inference settings。

`Generate` 會先刷新 preview，再用同一份 request 呼叫 `/chat`。

## Inference Modes

後端支援四種模式：

| Mode | 實際設定 | 學習重點 |
| --- | --- | --- |
| `manual` | 使用 request 內的 `temperature` 和 `top_k`。 | 直接觀察 sampling 參數。 |
| `greedy` | `temperature=0`、`top_k=null`。 | 每次都選分數最高的下一個 token。 |
| `focused` | `temperature=0.4`、`top_k=20`。 | 允許有限變化，但輸出較受限。 |
| `creative` | `temperature=1.0`、`top_k=80`。 | 從較大的候選 token 集合抽樣。 |

對未訓練的 tiny model 來說，這些模式不會讓輸出突然變成好語言；它們只是在改變 random 或很弱的 logits 如何被解碼。載入 GPT-2 或訓練後 checkpoint 後，這些控制才會更容易觀察。

## Prompt Preview API

先啟動 API：

```cmd
.venv\Scripts\activate.bat
python -m uvicorn apps.api.main:app --reload --port 8000
```

預覽 custom template：

```cmd
curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"random-tiny-byte\",\"max_new_tokens\":24,\"prompt_style\":\"custom\",\"prompt_template\":\"Question: {message}\nAnswer:\",\"inference_mode\":\"greedy\"}"
```

重點欄位：

- `effective_prompt_style`：解析 `model-default` 後真正使用的 style。
- `prompt`：真正會被 tokenize 的文字。
- `prompt_tokens`：rendered prompt 使用多少 token。
- `context_length`：模型 context window。
- `remaining_context_tokens`：生成前還剩多少 context。
- `temperature` 和 `top_k`：套用 inference mode 後的實際 decoding 設定。
- `warnings`：當 prompt 加上要求輸出長度超過 context 時的提醒。

## 用同一份設定產生結果

```cmd
curl -s -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"random-tiny-byte\",\"max_new_tokens\":24,\"prompt_style\":\"custom\",\"prompt_template\":\"Question: {message}\nAnswer:\",\"inference_mode\":\"greedy\"}"
```

回應會包含 `prompt_style`、`inference_mode`、`temperature`、`top_k`，後續記錄實驗時可以知道答案是怎麼生成的。

## 建議學習檢查

每次都用同一個 message：

```text
Every effort moves you
```

1. 比較 `raw`、`chat`、`instruction`，觀察 `prompt_tokens` 如何改變。
2. 切到 `custom`，使用 `Question: {message}\nAnswer:`，確認 rendered prompt 完全符合預期。
3. 保持同一個 prompt，比較 `greedy`、`focused`、`creative`。
4. 載入 GPT-2 small，問一個 instruction-style request，再比較 `model-default` 和 `instruction`。
5. 載入 instruction fine-tuned checkpoint 後，用同一個 prompt 重跑。這時 prompt template 應該要對齊該 checkpoint 的訓練格式。

這樣就完成最小 inference playground：開發者可以先看見輸入表面與 decoding policy，再判斷模型輸出。
