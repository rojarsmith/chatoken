# Chatoken 架構重整規劃

[English](restructure-plan.md) | [繁體中文](restructure-plan.zh-TW.md)

> 狀態：**僅為提案**。本規劃尚未變更任何程式碼、文件或 UI。
> 在每一個階段個別獲得確認之前，不會做任何修改。

## 1. 為什麼需要這份規劃

Chatoken 的既定目的是：

> 一個教學型專案，用來從零開始建立一個最小版的 ChatGPT 類系統。專案會先從 tiny PyTorch GPT
> 模型開始，接出 AI API 後端，並為後續 Next.js Web UI 做準備。過程會從隨機權重開始，訓練、
> 微調、接 API、蓋 Web UI。

專案目前已經具備教完這條路徑所需的全部素材，但它並沒有把素材呈現成一條路徑。功能是依照
「被開發的順序」堆上去的，而不是依照「應該被學習的順序」；而且每加一個新功能，就是再多一個
平行的頁籤、再多一份平行的文件、再多一段塞進同一個檔案裡的程式碼。

結果就是：學習者打開控制台，看到十六個長得一模一樣的頁籤，無法判斷該先做什麼、什麼依賴什麼、
一個概念在哪裡結束、下一個概念從哪裡開始。

本規劃在所有層面只套用一條規則：

> **一個階段只教一個新觀念，並且疊在前一個階段之上。**

## 2. 如何使用這份文件

這份文件是「共識」，不是「工作成果」。內容分成兩部分：

- **第 3–11 節：目標設計。** 完成後專案應該長什麼樣子。
- **第 12 節：執行階段。** 每個階段都很小、可獨立確認，而且結束時專案都是可運作的。

請一次確認一個階段：同意、否決或修改。未經確認的階段不會動工。

## 3. 現況（實際量測）

以下是從程式庫實際數出來的事實，不是主觀印象。

| 範圍 | 量測結果 |
| --- | --- |
| Web 控制台 | 1 個路由、1 個檔案：[`apps/web/app/page.jsx`](../apps/web/app/page.jsx)，共 **5,425 行** |
| Web 狀態 | 單一 `Home()` 元件內有 **112 個 `useState`** 與 8 個 `useEffect` |
| Web 樣式 | [`apps/web/app/globals.css`](../apps/web/app/globals.css) 共 **1,358 行**，全域作用域 |
| Web 導覽 | 單一 `TABS` 陣列中的 **16 個平行頁籤**，無分組、無順序、無進度 |
| API | [`apps/api/main.py`](../apps/api/main.py) 共 **862 行**、約 35 個端點、未使用 router |
| API 任務 | **3 套幾乎相同的任務系統**（chat / training / pretrained），各自有自己的 class、執行器、更新器、取消器與 lock |
| Service | [`training_service.py`](../apps/api/services/training_service.py) 共 **1,158 行**，同時涵蓋資料集、builder、訓練與實驗 |
| 核心函式庫 | `packages/llm_core` — 8 個模組，各 45–558 行。**這部分是健康的。** |
| 文件 | **18 個主題 × 2 種語言 = 36 個檔案**，全部平鋪在 `docs/`，沒有編號 |
| README 索引 | **一份平鋪的 36 條連結清單**，先 18 條英文、再 18 條中文，依開發順序排列 |
| 測試 | **0** |

### 目前的 16 個頁籤（依現有順序）

`GPT Model` · `Training Config` · `Chat` · `Conversation` · `Prompt Lab` · `External` ·
`Deploy` · `From Scratch` · `Raw Text` · `GPT-2` · `Instruction` · `LoRA` · `Chat SFT` ·
`Dataset Builder` · `Experiments` · `Checkpoints`

四種本質完全不同的東西被當成同一階層呈現：

- **概念** — GPT Model、Training Config
- **每個階段都會用到的工具** — Chat、Conversation、Prompt Lab、Checkpoints、Experiments
- **訓練階段** — From Scratch、Raw Text、GPT-2、Instruction、LoRA、Chat SFT、Dataset Builder
- **旁支主題** — External、Deploy

`Deploy` 排在第 7 位，但此時學習者連一次訓練都還沒跑過。`External`（呼叫別人代管的模型）排在
`From Scratch`（訓練自己的第一個模型）之前。`Checkpoints` 排在最後，但從第一次訓練開始就會產生
checkpoint。

## 4. 問題診斷

| # | 問題 | 對學習的影響 |
| --- | --- | --- |
| P1 | 沒有順序 | 學習者得自己猜順序，但順序本身就是課程內容。 |
| P2 | 沒有分組 | 十六個平行項目超出工作記憶負荷；四到五組則不會。 |
| P3 | 高度混雜 | 概念說明與訓練執行器長得一模一樣，於是兩者都顯得不重要。 |
| P4 | 一個畫面塞多個觀念 | 同一畫面同時出現資料集選擇、base model、超參數、執行控制與比較。 |
| P5 | 工具與課程互相搶注意力 | Chat 與 Checkpoints 是「每個階段進行中」都會用的工具，卻佔用頁籤位置像是一個階段。 |
| P6 | 文件複製了同樣的混亂 | 36 個平鋪檔案，依功能命名、依開發順序排列、中英文交錯。 |
| P7 | 看不到進度 | 沒有任何地方記錄或顯示學習者已完成什麼。 |
| P8 | 沒有統一詞彙 | 同一個階段在 UI、文件、API 各有不同名稱。 |
| P9 | 檔案大到無法拿來教學 | 一個 5,425 行的元件無法作為任何東西的範例來閱讀。 |

P1–P7 是課程問題，P8–P9 是結構問題——後者會讓前者無法乾淨修好。以下兩者都會處理。

## 5. 設計原則

1. **一個階段一個新觀念。** 如果一個階段要用兩句話才講得完重點，那它就是兩個階段。
2. **每個階段都疊在前一個之上。** 第 N 階段預設並沿用第 N-1 階段產出的成果。
3. **階段有順序也有編號。** 順序同時顯示在 UI、文件與檔名上。
4. **課程與工具是不同家具。** 階段放在階梯上；工具維持隨時可取用。
5. **一個畫面一個主要動作。** 其餘一律收合、降階或搬走。
6. **把證據指出來。** 每個階段都明確指名學習者該看哪一個數值或輸出。
7. **一套詞彙。** stage id 在 UI 路由、文件檔名、API tag 完全一致。
8. **不刪除任何東西。** 現有功能全都有去處，只是搬家，不是移除。
9. **檔案保持可讀。** 目標：任何原始碼檔不超過約 300 行、任何階段文件不超過約 250 行。

## 6. 課程主幹

五個部分、十七個階段，另加一條選修支線。所有現有功能都恰好對應到其中一項。

### Part 1 · Generate — *模型可以產生 token*

| ID | 階段 | 唯一的新觀念 | 你要做 | 你要觀察 |
| --- | --- | --- | --- | --- |
| S01 | Tokens | 模型看到的從來不是文字，而是整數 id | 對一句話做 encode 與 decode | token 數量、ids、還原回文字 |
| S02 | Forward pass | ids → embeddings → blocks → logits | 檢視建構順序，跑一次 forward | 136,704 個參數、logits 形狀、最高分 token |
| S03 | Decoding | 取樣控制的是形狀，不是知識 | 調整 `max_new_tokens`、`temperature`、`top_k` | 輸出會變，但依然無意義——權重是隨機的 |

### Part 2 · Train — *模型可以從資料學習*

| ID | 階段 | 唯一的新觀念 | 你要做 | 你要觀察 |
| --- | --- | --- | --- | --- |
| S04 | Training loop | loss 就是學習訊號 | 用 `every-effort` 訓練 `random-tiny-byte` | loss 下降；同一個 prompt 訓練前後的差異 |
| S05 | Training knobs | 超參數改變的是訓練迴圈，不是架構 | 調整 `max_steps`、`batch_size`、`block_size`、`learning_rate` | 哪個旋鈕影響速度、哪個影響穩定度 |
| S06 | Data scale | 好資料勝過更多步數 | 沿階梯爬升 `every-effort` → `every-effort-expanded` → `learning-dialogues` → `the-verdict` | 不同資料量下的 eval loss 與樣本品質 |
| S07 | Checkpoints | 模型是一個帶有血緣的檔案 | 儲存、列出、載入 checkpoint | 版本 id、base model、已記錄的訓練設定 |

### Part 3 · Reuse — *站在別人的訓練成果上*

| ID | 階段 | 唯一的新觀念 | 你要做 | 你要觀察 |
| --- | --- | --- | --- | --- |
| S08 | Pretrained GPT-2 | 相同架構，但算力是別人付的 | 下載並載入 GPT-2 124M | 真正的英文輸出；vocab 50,257 對比 257 |
| S09 | Prompt format | 不改任何權重，光改格式就能改變行為 | 比較 `raw` / `chat` / `instruction` / 自訂樣板與推論模式 | 權重完全相同，行為卻不同 |

### Part 4 · Align — *讓它聽懂指令並能對話*

| ID | 階段 | 唯一的新觀念 | 你要做 | 你要觀察 |
| --- | --- | --- | --- | --- |
| S10 | Instruction SFT | 用（指令, 回應）配對訓練，模型才會回答 | 以 `instruction-following` 對 GPT-2 做完整微調 | 同一道指令的訓練前後對照 |
| S11 | LoRA | 用約 1% 的可訓練參數達成同樣的行為改變 | 在 `instruction-lora` 上訓練 LoRA adapter | 可訓練參數比例與完整 SFT 的對比、輸出是否相當 |
| S12 | Chat SFT | 多輪逐字稿教會模型輪流發話 | 在 `chat-sft-lora` 上訓練 LoRA | 模型能否維持角色與輪次結構 |
| S13 | Your own dataset | 你的資料才是產品 | 建立範例、切分 train/eval、跑自訂 SFT | 極少量範例就足以改變行為 |
| S14 | Compare runs | 只比較可比較的東西 | 對兩次已儲存的實驗做差異比較 | 先看一致性摘要，再看生成樣本 |

### Part 5 · Ship — *把模型變成一個系統*

| ID | 階段 | 唯一的新觀念 | 你要做 | 你要觀察 |
| --- | --- | --- | --- | --- |
| S15 | Conversation memory | 模型是無狀態的，記憶由應用程式提供 | 跑一段多輪會話並預覽 context | 哪些歷史能存活過 context window |
| S16 | Streaming & cancel | token 是一個一個到的，而使用者必須能中止 | 串流一則回覆，然後取消它 | 事件流程、取消延遲 |
| S17 | Deploy & limits | 成本是 context 長度 × 併發數 | 讀取執行環境概況並估算資源 | 哪個維度成長最快 |

### 選修支線

| ID | 支線 | 觀念 | 為何不在主幹上 |
| --- | --- | --- | --- |
| T1 | External providers | 把自己的模型拿去和代管模型比較 | 它教的是整合，不是模型建構。有用，但沒有替階梯疊上新的一層。 |

### 涵蓋度檢查

現有每個頁籤都有去處，沒有東西被丟掉：

| 目前頁籤 | 變成 |
| --- | --- |
| GPT Model | S02 |
| Training Config | S05 |
| Chat | 常駐 Playground 面板（所有階段都看得到） |
| Conversation | S15 |
| Prompt Lab | S09 |
| External | T1 |
| Deploy | S17 |
| From Scratch | S04 |
| Raw Text | S06 |
| GPT-2 | S08 |
| Instruction | S10 |
| LoRA | S11 |
| Chat SFT | S12 |
| Dataset Builder | S13 |
| Experiments | S14 |
| Checkpoints | S07（課程）＋ Workbench（工具） |
| — | S01、S03 是新增階段，從目前埋在 `smoke_chat.py` 文件裡的內容拆出來 |

## 7. 階段頁面規格

每個階段畫面與每份階段文件都使用相同的六個區塊、相同的順序。一致性能讓學習者停止「找路」、
開始「學習」。

```
┌─ Stage 04 · Part 2 Train ───────────────────────────────────┐
│ FOCUS      一句話。唯一的新觀念。                            │
│ CONCEPT    簡短說明。最多一張圖。                            │
│ DO         一個主要動作。進階旋鈕收合。                      │
│ OBSERVE    明確指名要看的數值。                              │
│ EXIT CHECK 「以下全部成立時，你就可以往下走。」              │
│ DEEP DIVE  連到階段文件與程式碼對照表。                      │
└─────────────────────────────────────────────────────────────┘
```

每個階段畫面都必須遵守：

- 只有**一個**主要按鈕。
- 預設最多顯示**六個**控制項，其餘放在 `Advanced` 之後。
- 預設值就是教學預設值——什麼都不改的學習者也能得到預期的課程效果。
- OBSERVE 區塊絕不寫「看一下結果」，而是指名欄位。

## 8. 目標 UI 架構

### 版面

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Chatoken   ·   API online   ·   NVIDIA GeForce RTX 5070 Ti   ·   Docs      │
├───────────────────┬────────────────────────────────┬───────────────────────┤
│  階梯              │  階段畫布                       │  Playground           │
│                   │                                │                       │
│  Part 1 Generate  │  Stage 04 · Training loop      │  目前模型：            │
│   01 Tokens     ✓ │                                │   trained-tiny-byte   │
│   02 Forward    ✓ │  FOCUS                         │                       │
│   03 Decoding   ✓ │  CONCEPT                       │  [prompt............] │
│  Part 2 Train     │  DO        [ Run training ]    │  [ Send ]             │
│   04 Loop       ● │  OBSERVE                       │                       │
│   05 Knobs        │  EXIT CHECK                    │  輸出                  │
│   06 Data         │  DEEP DIVE →                   │                       │
│   07 Checkpoints  │                                │  （永遠顯示）          │
│  Part 3 Reuse     │                                │                       │
│   …               │                                │                       │
├───────────────────┴────────────────────────────────┴───────────────────────┤
│  WORKBENCH ▸   Models · Checkpoints · Datasets · Runs · External           │
└────────────────────────────────────────────────────────────────────────────┘
```

### 三個區域，三種職責

- **階梯（左）。** 課程本身。依 part 分組、編號，每個階段有狀態：`已完成` ✓、`目前` ●、
  `未開始`。收合的 part 讓可見清單維持簡短。
- **階段畫布（中）。** 一個階段、六個區塊、一個主要動作。
- **Playground（右）。** 永遠可用的對話面板，對象是目前載入的模型。它取代 `Chat` 頁籤。
  每個階段結束時都能直接「和你剛做出來的東西講話」，不必離開畫面。

**Workbench** 是抽屜，不是頁籤列：Models、Checkpoints、Datasets、Runs、External 供應商設定。
這些是多個階段都會用到的檢視工具，因此不應該和階段搶注意力。

### 導覽與進度

- 路由：`/`（課程地圖）、`/stage/04-training-loop`、`/workbench/checkpoints`、`/track/external`。
- 進度以 `localStorage` 逐階段記錄：`not-started` / `in-progress` / `done`。
- 階段**有順序但不上鎖**。學習者可以跳；跳過順序時顯示一行提示：
  *「本階段假設你已完成 S03，但你尚未完成。」*
- `/` 地圖一次顯示整條階梯，讓課程的形狀在開始前就看得見。

## 9. 目標程式庫結構

### Web

```
apps/web/
  app/
    layout.jsx
    page.jsx                       # 只放課程地圖
    stage/[stageId]/page.jsx       # 階段外殼，由內容註冊表驅動
    workbench/[toolId]/page.jsx
    track/[trackId]/page.jsx
  content/
    curriculum.js                  # parts、stages、順序、先修條件
    stages/
      s01-tokens.js                # 文案 + 本階段掛載哪些面板
      s02-forward-pass.js
      …
  components/
    layout/    TopBar · LadderRail · Playground · WorkbenchDrawer
    stage/     StageHeader · FocusBlock · ConceptBlock · DoBlock ·
               ObserveBlock · ExitCheck · DeepDive
    panels/    TokenizerPanel · ForwardPassPanel · TrainingPanel ·
               DatasetLadderPanel · CheckpointPanel · LoraPanel · …
    ui/        Card · Metric · Knob · JobStatus · CompareColumns
  lib/
    api.js                         # 單一 fetch 層
    hooks/     useJob · useModels · useStream · useProgress
    format.js
  styles/                          # 從 1,358 行的 globals.css 拆出
```

行數預算：任何檔案不超過約 300 行。現有 5,425 行的 `page.jsx` 會變成約 40 個檔案，而每個面板
本身也會成為一個可讀的範例——這件事很重要，因為這是教學型專案，UI 程式碼同樣是教材。

### API

```
apps/api/
  main.py            # app factory、CORS、router 註冊（約 60 行）
  routers/
    health.py  models.py  chat.py  conversations.py  training.py
    datasets.py  checkpoints.py  pretrained.py  experiments.py
    external.py  deployment.py
  schemas/           # pydantic 請求／回應模型，依領域拆分
  jobs/registry.py   # 單一泛用任務註冊表，取代 3 套重複實作
  services/          # 職責不變，但移除任務管線程式碼
```

`main.py` 中三套平行的任務系統（`ChatJob`、`TrainingJob`、`PretrainedJob`，各自帶著自己的
`_run_*`、`_update_*`、`_cancel_*`、`_*_cancel_requested` 與 lock）會收斂成一套泛用註冊表。
這大約可移除 200 行重複程式碼，且行為不變。

`training_service.py`（1,158 行）沿著它本來就存在的接縫拆開：
`dataset_registry.py` · `dataset_builder.py` · `trainer.py` · `experiment_store.py`。

**端點路徑完全不變。** API 重構屬於內部整理，因此 Web 遷移與 API 重構永遠不必綁在一起上線。

### 文件

```
docs/
  README.md / README.zh-TW.md          # 課程索引——唯一入口
  stages/
    01-tokens.md            01-tokens.zh-TW.md
    02-forward-pass.md      02-forward-pass.zh-TW.md
    …
    17-deploy-limits.md     17-deploy-limits.zh-TW.md
  tracks/
    external-models.md      external-models.zh-TW.md
  reference/
    setup.md  gpu-runtime.md  api.md  architecture.md  glossary.md  troubleshooting.md
    （每份都有對應的 .zh-TW.md）
  restructure-plan.md       restructure-plan.zh-TW.md   # 本文件
```

根目錄的 `README.md` 縮減為：Chatoken 是什麼、如何安裝、如何啟動，以及一條指向課程索引的連結。
那份 36 條連結的平鋪清單會從 README 移除，但不是從專案移除——`docs/README.md` 會成為有順序的
索引，而每份文件的語言切換維持現在的作法完全不變。

## 10. 命名契約

每個階段只有一個 id，處處通用。這正是防止 UI、文件、API 各自漂移的機制。

| 介面 | 形式 |
| --- | --- |
| Stage id | `04-training-loop` |
| Web 路由 | `/stage/04-training-loop` |
| 內容模組 | `apps/web/content/stages/s04-training-loop.js` |
| 文件 | `docs/stages/04-training-loop.md`（＋ `.zh-TW.md`） |
| API tag | 相關端點掛上 `stage:04-training-loop` |
| 進度鍵值 | `chatoken.progress.04-training-loop` |

建議的單一事實來源：程式庫根目錄放一份 `curriculum.json`，由 Web 在 build 時讀取，並由一個小型
檢查腳本驗證每個階段都具備兩種語言文件與內容模組。詳見決策 D4。

## 11. 文件計畫

### 階段文件樣板

每份階段文件都有相同的十個段落，順序固定：

1. 標題、語言切換行、`Stage N · Part` 標示行
2. **Focus** — 一句話
3. **Prerequisites** — 前一階段與它產出的成果
4. **Concept** — 400 字以內，最多一張圖
5. **Run it** — 先寫控制台步驟，再寫 CLI／`curl` 等價指令
6. **What to observe** — 編號列點，每點對應畫面上一個具名數值
7. **Exit check** — 檢查清單
8. **Common problems**
9. **Code map** — 本階段涉及的檔案與函式
10. **Next stage** — 一條連結

### 遷移對照表

| 現有文件 | 去處 |
| --- | --- |
| `learning-experience.md` | 拆進 S01–S03 的 exit check，以及 `reference/troubleshooting.md` |
| `smoke-chat.md` | S01 概念 ＋ S02/S03 的 code map |
| `model-foundations.md` | S02 |
| `training-loop.md` | S04 |
| `smoke-train.md` | S04 的 code map |
| *（新增）* | S05，取自目前 Training Config 頁籤的文案 |
| `dataset-ladder-experiments.md` | S06 |
| `model-version-experiment-comparison.md` | 拆分：版本管理 → S07，比較 → S14 |
| `gpt2-pretrained.md` | 拆分：載入 → S08，instruction prompt → S09/S10 |
| `inference-prompt-playground.md` | S09 |
| `lora-peft.md` | S11 |
| `minimal-chat-model.md` | S12 |
| `dataset-builder.md` | S13 |
| `conversation-memory.md` | S15 |
| `streaming-chat-cancel.md` | S16 |
| `deployment-resource-limits.md` | S17 |
| `external-model-integration.md` | `tracks/external-models.md` |
| `gpu-runtime.md` | `reference/gpu-runtime.md` |
| `web-console.md` | 拆分：28 步驟導覽變成 `docs/README.md`；UI 說明變成 `reference/architecture.md` |

現有每份文件都會被搬移、拆分或吸收，沒有任何一份被丟棄。

為了不讓現有連結立刻失效，每個舊路徑可以保留一行指向新位置的指標檔案，維持一個版本。詳見決策 D6。

## 12. 執行階段

每個階段都可獨立確認，且結束時程式庫都是可運作的。Size 是相對工作量，不是時間估計。

### Phase 0 — 確認主幹 · Size S · 不動程式碼

確認第 6 節（17 個階段、順序，以及各自唯一的觀念）與第 10 節的命名契約。後續一切都依賴這一步，
其他階段都不能先開工。

**產出：** 一份被確認的階段表。
**驗證：** 由你確認清單。

---

### Phase 1 — 文件重整 · Size M · 只動文件，零程式碼變更

建立 `docs/stages/`、`docs/tracks/`、`docs/reference/`。依第 11 節的樣板，把現有 18 個主題搬移並
改寫成 17 份階段文件、1 份支線文件與參考資料集，兩種語言都做。撰寫新的 `docs/README.md` 課程索引。
將根目錄 `README.md` 精簡為安裝說明加一條連結。

**為何先做：** 這是成本最低的階段，能在任何程式碼搬動前先驗證課程設計；如果階梯設計是錯的，
在這裡發現遠比之後便宜。
**驗證：** 每個階段都有兩種語言檔案；所有連結都能解析；有序索引讀起來像一門課。

---

### Phase 2 — Web 外殼 · Size L · 新 UI 骨架，舊控制台仍可存取

建立 `curriculum.js`、路由（`/`、`/stage/[stageId]`）、LadderRail、TopBar、Playground、
WorkbenchDrawer、`lib/api.js` 與六個階段區塊。先遷移 **S01–S03** 作為第一批真實階段。
把現有控制台保留在 `/legacy`，確保遷移過程中沒有東西消失。

**驗證：** 階段 01–03 能對著未更動的 API 完整運作；`/legacy` 仍可使用。

---

### Phase 3 — 遷移 Part 2 與 Part 3 · Size L

把 S04–S07（訓練迴圈、旋鈕、資料規模、checkpoints）與 S08–S09（pretrained GPT-2、prompt 格式）
從 `page.jsx` 搬進面板。把 Checkpoints 與 Models 瀏覽器移進 Workbench。

**驗證：** 每個已遷移階段都重現舊頁籤的行為，而多餘的控制項收在 `Advanced` 之後。

---

### Phase 4 — 遷移 Part 4 與 Part 5 · Size L

搬移 S10–S14（instruction SFT、LoRA、chat SFT、dataset builder、實驗比較）與 S15–S17
（會話記憶、串流與取消、部署與限制），以及支線 T1（外部供應商）。等每個頁籤都有歸屬後，
刪除 `/legacy` 與舊的 `page.jsx`。

**驗證：** 第 6 節的涵蓋度表格完全滿足；舊控制台裡沒有任何功能變成無法存取。

---

### Phase 5 — API 重構 · Size M · 不變更任何端點

將 `main.py` 拆成 routers、抽出泛用任務註冊表、拆分 `training_service.py`、為端點加上對應 stage id
的 OpenAPI tag。先加入一組小型 `tests/`——大約 6–10 個 API smoke test——讓重構是可驗證的，
而不是靠運氣。

**驗證：** 重構前後測試都通過；所有端點路徑與回應結構不變；Web 端不需要任何修改。

---

### Phase 6 — 一致性收尾 · Size S

對齊剩餘命名（dataset id、model id、腳本名稱）、加入課程檢查腳本、補上 `reference/glossary.md`，
並以新學習者的角度從 S01 走到 S17，修掉任何打斷流程的地方。

**驗證：** 從全新 clone 完整走完一輪，過程中不需要查閱 `docs/README.md` 以外的任何東西。

## 13. 不做的事

本規劃明確**不會**：

- 新增任何機器學習能力、資料集或模型；
- 移除任何現有功能——全部只是搬家；
- 重寫 `packages/llm_core`，它已經夠小且可讀；
- 引入資料庫、驗證機制或雲端部署；
- 更動任何 API 端點路徑或回應結構；
- 改變訓練行為或數值結果。

## 14. 待決事項

以下會影響工作內容，需要你決定。已標註建議選項。

| # | 決策 | 選項 | 建議 |
| --- | --- | --- | --- |
| D1 | 階段粒度 | 維持所列的 17 個階段，或合併為約 12 個（S05 併入 S04、S09 併入 S08、S14 併入 S13、S16 併入 S15） | **17 個。** 每一次合併都會讓一個畫面出現兩個觀念，那正是我們要修的問題。 |
| D2 | UI 語言 | 英文 UI ＋ 雙語文件（維持現狀），或加上語言切換的雙語 UI | **先做英文 UI。** UI i18n 會牽動每一個階段的字串；等階梯定案後，它是一個乾淨的後續階段。 |
| D3 | 進度鎖定 | 軟性（有順序、可跳、附提示橫幅）或硬性（前一階段未完成就上鎖） | **軟性。** 學習者本來就會回頭與跳躍，硬鎖只會懲罰這種行為。 |
| D4 | 課程單一事實來源 | 根目錄一份 `curriculum.json`，由 Web 與文件檢查腳本共用；或 Web 與文件各自維護清單 | **`curriculum.json`。** UI 與文件漂移正是問題 P8。 |
| D5 | 腳本命名 | 保留 `smoke_chat.py` / `smoke_train.py`，或改成對應階段的名稱 | **保留。** 多份文件都引用它們，改名效益很低。 |
| D6 | 舊文件路徑 | 保留一行指標檔案維持一個版本，或立即刪除 | **保留指標。** 成本極低，且外部連結仍可用。 |

## 15. 風險

| 風險 | 緩解方式 |
| --- | --- |
| 程式碼搬完後才發現課程順序不對 | Phase 1 只動文件且排在最前面；順序會先在文字層驗證，才動任何元件。 |
| 拆分 `page.jsx` 弄丟行為 | 逐階段遷移；Phase 2–3 期間保留可存取的 `/legacy`；等涵蓋度表格滿足後才刪除。 |
| API 重構改變訓練結果 | 端點路徑與回應結構凍結；測試先於重構落地；`llm_core` 完全不動。 |
| 文件變動打斷既有連結 | 舊路徑保留一行指標檔案維持一個版本（D6）。 |
| 重整做到一半停擺 | 每個階段結束時都是可運作狀態，而且 Phase 1、5、6 即使其餘延後也各自具備獨立價值。 |

## 16. 成功的樣子

一位從未看過這個程式庫的開發者：

1. 打開 `docs/README.md`，看到一門 17 個階段、分成五個部分的課程。
2. 打開控制台，看到同一條階梯，階段 01 被標示為目前進度。
3. 花幾分鐘完成階段 01，並清楚知道自己剛學會的那**一個**觀念是什麼。
4. 一路走到階段 17，過程中從來不需要問「我接下來該做什麼？」。
5. 能夠一口氣讀完專案中的任何一個原始碼檔案。
