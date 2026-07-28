# Stage 01 · Tokens

[English](01-tokens.md) | [繁體中文](01-tokens.zh-TW.md)

**Part 1 · Generate** — 17 個階段中的第 1 個 · [課程索引](../README.zh-TW.md)

## Focus

模型看到的從來不是你的文字，而是一串整數 id。

## Prerequisites

- 已建立並啟用專案虛擬環境，且已執行 `pip install -e .`。
  請見[根目錄 README](../../README.zh-TW.md) 的安裝章節。

這是第一個階段，不需要其他前置條件。

## Concept

語言模型是一個定義在整數上的函式。在任何模型存在之前，必須先有東西把
`"Every effort moves you"` 變成一串數字，再把數字變回文字。那個東西就是 **tokenizer**，
它是一個獨立且固定的元件——它不會在訓練中被學習。

Chatoken 內建兩種 tokenizer，兩者的差異在後面很關鍵：

| | `ByteTokenizer` | `GPT2Tokenizer` |
| --- | --- | --- |
| 使用者 | `random-tiny-byte` 以及你在 Part 2 訓練的一切 | GPT-2，從 Stage 08 開始 |
| 規則 | 一個 UTF-8 **byte** = 一個 token | byte-pair encoding（BPE），學習得來的合併規則 |
| 詞彙量 | 257 | 50,257 |
| EOS id | 256 | 50,256 |
| 需要下載 | 否 | 是（`vocab.json`、`merges.txt`） |

byte tokenizer 刻意做得很笨：id `0..255` 就是原始位元組，id `256` 保留給 end-of-sequence。
不學習、不下載，而且任何輸入都能被編碼。這正是第一個學習迴圈需要的工具。

有兩個後果要帶到後面：

1. **詞彙量是模型的一個維度。** 模型的輸出頭會替詞彙表中每一項產生一個分數，所以
   `vocab_size` 就是最後一層的寬度。換 tokenizer 等於換模型。
2. **decode 可能失敗。** `ByteTokenizer.decode` 使用 `errors="backslashreplace"`，因此不是合法
   UTF-8 的位元組會以 `\xNN` 的逸出字元回傳，而不是丟出例外。這就是為什麼 Stage 03 裡未訓練
   模型的輸出看起來像亂碼：那不是 bug，而是一段隨機位元組被誠實地解碼出來。

## Run it

### 從指令列

編碼一句話，再解碼回來：

```cmd
python -c "from llm_core.tokenizer import ByteTokenizer; t = ByteTokenizer(); ids = t.encode('Every effort moves you'); print(len(ids)); print(ids); print(t.decode(ids))"
```

編碼 chat 模型實際收到的 prompt——注意樣板本身也會佔 token：

```cmd
python -c "from llm_core.generation import prepare_chat_prompt; from llm_core.tokenizer import ByteTokenizer; p = prepare_chat_prompt('Every effort moves you'); print(repr(p)); print(len(ByteTokenizer().encode(p)))"
```

編碼非 ASCII 文字，此時一個字元不再等於一個 token：

```cmd
set PYTHONIOENCODING=utf-8
python -c "from llm_core.tokenizer import ByteTokenizer; print(len(ByteTokenizer().encode('每一分努力')))"
```

### 透過 API

在 API 啟動的狀態下（`python -m uvicorn apps.api.main:app --reload --port 8000`），
問它一則訊息如何變成 prompt、以及這個 prompt 花掉多少 token：

```cmd
curl -s -X POST http://127.0.0.1:8000/chat/prompt-preview ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Every effort moves you\",\"model_id\":\"random-tiny-byte\"}"
```

### 在控制台

開啟 `http://127.0.0.1:3000`，在階梯上選 **Stage 01 · Tokens**。面板在瀏覽器端使用同樣的
「一個位元組一個 token」規則編碼，所以你打字時 ids 會即時更新。按 **Ask the API** 可以拿它跟
伺服器自己的 tokenizer 對照。

## What to observe

1. `Every effort moves you` 編碼成 **22 個 token**——一個位元組一個，包含 3 個空格。
2. ids 開頭是 `[69, 118, 101, 114, 121, 32, ...]`。`69` 是 `E`，`32` 是空格。這是 ASCII，
   不是模型自己挑的。
3. 把 ids 解碼回來會得到與原文完全相同的字串。這個來回是無損的。
4. chat prompt 是 `'User: Every effort moves you\nAssistant:'`，共 **39 個 token**。
   在你的訊息被考慮之前，樣板本身就先花掉 17 個 token。
5. `每一分努力`——五個字——編碼成 **15 個 token**，因為這些字每個都是三個 UTF-8 位元組。
   token 數不等於字元數。
6. `prompt-preview` 回報的 `prompt_tokens` 就是模型將會看到的數量，並附上任何 context 長度警告。

## Exit check

以下全部成立時，你就可以往下走：

- [ ] 你能在不使用「模型」這個詞的前提下說明 tokenizer 做什麼。
- [ ] 你知道為什麼 `vocab_size` 是 257，以及 id 256 的用途。
- [ ] 你能在執行指令之前就預測一個 ASCII 字串的 token 數。
- [ ] 你理解 prompt 樣板會替每一次請求增加 token。

## Common problems

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `ModuleNotFoundError: llm_core` | 套件沒有安裝進目前啟用的 venv | 啟用 `.venv`，然後執行 `python -m pip install -e .` |
| CJK 範例出現 `UnicodeEncodeError` | Windows 主控台的 code page 不是 UTF-8 | 如上所示，先執行 `set PYTHONIOENCODING=utf-8` |
| `prompt-preview` 回傳 404 | API 沒有啟動 | 在 8000 埠啟動 uvicorn |

## Code map

| 內容 | 位置 |
| --- | --- |
| `ByteTokenizer`、`GPT2Tokenizer`、`tokenizer_for_name` | [`packages/llm_core/llm_core/tokenizer.py`](../../packages/llm_core/llm_core/tokenizer.py) |
| Prompt 樣板與 `prepare_chat_prompt` | [`packages/llm_core/llm_core/generation.py`](../../packages/llm_core/llm_core/generation.py) |
| 模型設定中的 `vocab_size` | [`packages/llm_core/llm_core/configs.py`](../../packages/llm_core/llm_core/configs.py) |
| `POST /chat/prompt-preview` | [`apps/api/main.py`](../../apps/api/main.py) → `ChatService.preview_prompt` |

## Next stage

[**Stage 02 · Forward pass**](02-forward-pass.zh-TW.md) — 這些 id 如何變成 embedding、
通過 transformer block，最後變成詞彙表中每一項各一個分數。
