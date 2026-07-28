# Reference · 名詞表

[English](glossary.md) | [繁體中文](glossary.zh-TW.md)

[課程索引](../README.zh-TW.md)

依學習者遇到的順序排列，括號內為首次出現的階段。

## Part 1 · Generate

**Token**（01）— 模型實際處理的單位。不是字、也不是字元，而是 tokenizer 產生的整數 id。

**Tokenizer**（01）— 那個固定、不被學習的元件，負責把文字對應成 id 再對應回來。本專案有兩個：
`ByteTokenizer`（一個 UTF-8 位元組一個 token，詞彙量 257）與 `GPT2Tokenizer`（BPE，詞彙量 50,257）。

**Vocabulary size / 詞彙量**（01）— 存在多少個不同的 id。它同時也是模型輸出層的寬度，
所以換 tokenizer 就等於換模型。

**BPE**（01, 08）— byte-pair encoding。學習得來的合併規則，把常見字元序列壓成單一 token。

**EOS**（01, 03）— end-of-sequence 的 id（byte 是 256，GPT-2 是 50,256）。取樣到它就會提早結束生成。

**Embedding**（02）— 把 id 轉成向量的查找表。token embedding 說*是什麼*；position embedding
說*在哪裡*。兩者相加，不是串接。

**Logits**（02）— 未正規化的原始分數，在每個位置上詞彙表各一個。不是機率，也不是文字。

**Causal mask / 因果遮罩**（02）— 上三角的 `-inf` 遮罩，讓位置 *i* 無法注意到它之後的東西。
它是這東西之所以是語言模型的原因。

**Residual connection / 殘差連接**（02）— 把區塊的輸入加回它的輸出，給梯度一條回程捷徑。

**Context length**（02, 15）— 模型能處理的最長序列，由 position embedding 表固定。
tiny 模型是 64，GPT-2 是 1,024。這是硬性限制。

**Temperature**（03）— 取樣旋鈕。`0` 代表永遠取最高分；大於 `0` 則在取樣前先除以它。
小於 1 銳化、大於 1 壓平。

**Top-k**（03）— 在取樣前把候選集合限制在分數最高的 *k* 個 id。

**Greedy decoding**（03）— `temperature=0`。確定性；每次輸出相同。

## Part 2 · Train

**Loss**（04）— 模型對正確答案有多驚訝。這裡用 cross-entropy。在 257 個 id 上均勻亂猜會得到
`ln(257) ≈ 5.55`。

**Cross-entropy**（04）— 把預測分布與唯一正確 id 相比的損失函式。

**Step**（04, 05）— 對一個 batch 做一次最佳化更新。不是掃過資料一遍。

**Batch size**（05）— 每步使用幾個視窗。越大梯度越平滑、越吃記憶體。

**Block size**（05）— 訓練視窗長度（以 token 計）。不能超過 `context_length`。

**Learning rate**（05）— 最佳化器的步伐大小。穩定度旋鈕：太高會發散，太低會停滯。

**AdamW**（04, 17）— 全程使用的最佳化器。它為每個參數保留兩份狀態張量，這主宰了訓練記憶體。

**Epoch**（05）— 完整掃過資料集一遍。本專案改以 step 計數，因為它的資料集小到會被讀很多遍。

**Overfitting / 過擬合**（04, 06）— 背下訓練資料而非學到規律。在 Stage 04 是刻意且有用的；
在 Stage 06 則是要擺脫的。

**Checkpoint**（07）— 存下的檔案，包含權重、設定、tokenizer 名稱、訓練摘要與血緣。
在本專案中永遠是完整快照，不是差異。

**Lineage / 血緣**（07）— `base_model_id` 鏈，記錄一個模型是從什麼訓練來的。

## Part 3 · Reuse

**Pretrained model**（08）— 別人訓練好的權重，被載入到同一個架構中。

**Base model**（08）— 只被訓練來續寫文字的模型。它會用更多文字回應問題，而不是用答案。

**Prompt template**（09）— 包在你訊息外面的東西：`raw`、`chat`、`instruction` 或 `custom`。
它花 token、改變行為，但不改變任何權重。

**Inference mode**（09）— 一組具名的解碼設定：`greedy`、`focused`、`creative` 或 `manual`。

## Part 4 · Align

**SFT**（10）— 監督式微調。用示範你想要的行為的範例來訓練。

**Instruction tuning**（10）— 在（指令, 回應）配對上做 SFT，讓 base 模型改為回答而不是續寫。

**Catastrophic forgetting / 災難性遺忘**（10）— 微調過猛而失去既有能力。
這就是 learning rate 相對 Part 2 降低約 60 倍的原因。

**LoRA**（11）— low-rank adaptation。凍結 base，在被選中的層旁訓練小的 `A`/`B` 矩陣。

**Rank**（11）— LoRA adapter 的瓶頸寬度。越高擬合越多、成本越高。

**Adapter**（11）— 加在凍結模型上的小型可訓練部件。在本專案中會被合併進完整 checkpoint。

**PEFT**（11）— parameter-efficient fine-tuning，LoRA 所屬的家族。

**Loss masking**（12）— 把目標位置設成 `-100`，讓 `cross_entropy` 跳過它們。
用來只在助理 token 上訓練。

**Train/eval split**（13）— 把範例保留在訓練之外，好用來測試泛化能力。必須在*看結果之前*就保留，
否則證明不了任何事。

## Part 5 · Ship

**Stateless / 無狀態**（15）— 模型在兩次呼叫之間什麼都不保留。所有看似記憶的東西，
都是應用程式重新送出歷史。

**Context window**（15）— 模型對「能注意到多少歷史」的真實限制。與應用程式的歷史預算不是同一回事。

**Streaming / 串流**（16）— 在生成過程中就送出 token，而不是等迴圈結束。它改變感知延遲，
不改變總時間。

**Cooperative cancellation / 合作式取消**（16）— worker 在安全點檢查旗標並乾淨退出，
而不是被強制砍掉。

**KV cache**（17）— 快取的 key 與 value，讓正式伺服器省下重算。本專案有估算但未實作；
這個迴圈每個 token 都重算。

**Concurrency / 併發**（17）— 同時進行的請求。權重只付一次；context 記憶體每個請求各付一份。

**Precision / 精度**（17）— 權重的數值格式。fp16 讓參數池減半，其他不變。
