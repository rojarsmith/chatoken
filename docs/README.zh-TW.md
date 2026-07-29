# Chatoken 課程

[English](README.md) | [繁體中文](README.zh-TW.md)

從零開始建立一個最小版的 ChatGPT 類系統，一次只學一個觀念。

這是整個專案的有序索引。從 Stage 01 開始往下走。每個階段只教**一個新觀念**、疊在前一階段之上，
並在結尾給你一份檢查清單，讓你自己判斷可不可以往下一階段。

> **控制台。** 階梯已上線於 `http://127.0.0.1:3000`，17 個階段與選修支線全部都有互動面板。
> 每份階段文件同時提供指令列與 API 步驟，因此完全不用控制台也能走完課程。
>
> **助理** 在 `/assistant`，是整門課要做出來的產品：一個有會話與設定的聊天應用，
> 跑在你訓練出來的模型上。從第一階段就能用——只是在你訓練出東西之前，它答得很糟。
>
> **GPU 或 CPU** 可以隨時從頂端列切換，不需要重啟 API。
> 用兩種裝置各跑一次 Stage 04，比任何一段文字都更能說明 GPU 在做什麼。

## 開始之前

建立虛擬環境、啟動 API 與控制台：[安裝設定](reference/setup.zh-TW.md)。
你需要 Windows CPython 3.11–3.13；在這個環境下 PyTorch 尚無 3.14 的 wheel。

## 課程階梯

### Part 1 · Generate — *模型可以產生 token*

| | 階段 | 唯一的新觀念 |
| --- | --- | --- |
| 01 | [Tokens](stages/01-tokens.zh-TW.md) | 模型看到的從來不是文字，而是整數 id |
| 02 | [Forward pass](stages/02-forward-pass.zh-TW.md) | ids → embeddings → blocks → logits |
| 03 | [Decoding](stages/03-decoding.zh-TW.md) | 取樣控制的是形狀，不是知識 |

### Part 2 · Train — *模型可以從資料學習*

| | 階段 | 唯一的新觀念 |
| --- | --- | --- |
| 04 | [Training loop](stages/04-training-loop.zh-TW.md) | loss 就是學習訊號 |
| 05 | [Training knobs](stages/05-training-knobs.zh-TW.md) | 超參數改變的是訓練迴圈，不是架構 |
| 06 | [Data scale](stages/06-data-scale.zh-TW.md) | 好資料勝過更多步數 |
| 07 | [Checkpoints](stages/07-checkpoints.zh-TW.md) | 模型是一個帶有血緣的檔案 |

### Part 3 · Reuse — *站在別人的訓練成果上*

| | 階段 | 唯一的新觀念 |
| --- | --- | --- |
| 08 | [Pretrained GPT-2](stages/08-pretrained-gpt2.zh-TW.md) | 相同架構，但算力是別人付的 |
| 09 | [Prompt format](stages/09-prompt-format.zh-TW.md) | 不改任何權重，光改格式就能改變行為 |

### Part 4 · Align — *讓它聽懂指令並能對話*

| | 階段 | 唯一的新觀念 |
| --- | --- | --- |
| 10 | [Instruction SFT](stages/10-instruction-sft.zh-TW.md) | 用（指令, 回應）配對訓練，模型才會回答 |
| 11 | [LoRA](stages/11-lora.zh-TW.md) | 用約 1% 的可訓練參數達成同樣的行為改變 |
| 12 | [Chat SFT](stages/12-chat-sft.zh-TW.md) | 多輪逐字稿教會模型輪流發話 |
| 13 | [Your own dataset](stages/13-your-own-dataset.zh-TW.md) | 你的資料才是產品 |
| 14 | [Compare runs](stages/14-compare-runs.zh-TW.md) | 只比較可比較的東西 |

### Part 5 · Ship — *把模型變成一個系統*

| | 階段 | 唯一的新觀念 |
| --- | --- | --- |
| 15 | [Conversation memory](stages/15-conversation-memory.zh-TW.md) | 模型是無狀態的，記憶由應用程式提供 |
| 16 | [Streaming & cancel](stages/16-streaming-cancel.zh-TW.md) | token 是一個一個到的，而使用者必須能中止 |
| 17 | [Deploy & limits](stages/17-deploy-limits.zh-TW.md) | 成本是 context 長度 × 併發數 |

## 選修支線

不在階梯上——它教的是整合而非模型建構，後面也沒有任何階段依賴它。Stage 09 之後隨時可做。

| 支線 | 觀念 |
| --- | --- |
| [外部供應商](tracks/external-models.zh-TW.md) | 把自己的模型拿去和代管模型比較 |

## 參考資料

需要時再查，不屬於課程順序的一部分。

| 文件 | 用途 |
| --- | --- |
| [安裝設定](reference/setup.zh-TW.md) | 虛擬環境、相依套件、第一次執行 |
| [GPU runtime](reference/gpu-runtime.zh-TW.md) | PyTorch 的 CUDA 設定——從 Stage 10 起訓練時間才會合理 |
| [API](reference/api.zh-TW.md) | 所有端點，依階段分組 |
| [架構](reference/architecture.zh-TW.md) | `llm_core`、API 與控制台如何組合在一起 |
| [名詞表](reference/glossary.zh-TW.md) | 名詞集中處：logits、loss、checkpoint、adapter、context window |
| [疑難排解](reference/troubleshooting.zh-TW.md) | 從各階段彙整的症狀與解法 |

## 每個階段的文件結構

每份階段文件都是同一個結構，格式只需要學一次：

| 段落 | 提供什麼 |
| --- | --- |
| **Focus** | 一句話：唯一的新觀念 |
| **Prerequisites** | 前一階段，以及它產出了什麼 |
| **Concept** | 說明——簡短，最多一張圖 |
| **Run it** | 指令列、API、控制台三條路徑通往同一個結果 |
| **What to observe** | 明確指名要看的數值 |
| **Exit check** | 判斷可以往下走的檢查清單 |
| **Common problems** | 症狀 → 原因 → 解法 |
| **Code map** | 本階段涉及的檔案與函式 |
| **Next stage** | 下一個觀念從哪裡來 |

每份文件都有英文與繁體中文版本，頂端附語言切換連結。

## 關於這次重整

這個課程配置背後的理由——舊結構哪裡出問題、目標架構是什麼、以及逐階段的執行計畫——都寫在
[架構重整規劃](restructure-plan.zh-TW.md)。
