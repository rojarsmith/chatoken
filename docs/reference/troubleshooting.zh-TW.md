# Reference · 疑難排解

[English](troubleshooting.md) | [繁體中文](troubleshooting.zh-TW.md)

[課程索引](../README.zh-TW.md)

彙整自各階段的症狀。先看「其實沒壞」那一節——大多數早期的意外都屬於那裡。

## 其實沒壞

| 你看到的 | 為什麼那是正確的 |
| --- | --- |
| 像 `\xc9\x11c` 的輸出 | 未訓練模型送出隨機位元組；`ByteTokenizer.decode` 把非法 UTF-8 顯示成逸出字元。Stage 01、03 |
| 第 1 步 loss 接近 5.55 | `ln(257)` — 在位元組詞彙上均勻亂猜。Stage 04 |
| `every-effort` 上 loss 趨近 0 | 在 4 行資料集上刻意過擬合。Stage 04 |
| 更大的資料集最終 loss 更高 | 資料更難、學到更多。Stage 06 |
| GPT-2 續寫你的問題而不是回答 | 它是 base 模型。Stage 08 |
| 模型一輪之後就「忘記」 | `random-tiny-byte` 的 context 視窗只有 64 token。Stage 15 |
| 生成的 token 少於你要求的 | 取樣到 EOS id。Stage 03 |
| 取消執行中的任務要幾秒才停 | 合作式取消。Stage 16 |
| 全新 clone 沒有任何 checkpoint | `models/` 被 git 忽略。課程會產生它們。 |

## 環境

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `ModuleNotFoundError: llm_core` | 套件沒安裝進啟用中的 venv | `.venv\Scripts\activate.bat`，然後 `python -m pip install -e .` |
| `torch` 裝不起來 | Python 3.14 | 改用 3.11–3.13；重建 `.venv` |
| `python` 解析到專案外 | venv 沒啟用 | `python -c "import sys; print(sys.executable)"` 必須顯示專案路徑 |
| 印 CJK 時 `UnicodeEncodeError` | 主控台 code page 不是 UTF-8 | `set PYTHONIOENCODING=utf-8` |
| 指令行為怪異 | 在 PowerShell 或 MSYS2 中執行 | 使用 Windows Command Prompt |

## API

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 8000 埠連線被拒 | API 沒啟動 | `python -m uvicorn apps.api.main:app --reload --port 8000` |
| `422 Unprocessable Entity` | 某個值超出 schema 範圍 | `max_new_tokens` ≤ 200、`temperature` ≤ 2、`top_k` ≤ 200、`max_steps` ≤ 2000 |
| `Unknown model_id` | 模型從未載入，或 API 重啟過 | 已載入模型存在記憶體中；重新載入 checkpoint 或 GPT-2 |
| `Unknown dataset_id` | 打錯字，或資料集未準備 | `GET /training/datasets` |
| 瀏覽器被 CORS 擋下 | web 來源不被允許 | 本機開發已啟用 CORS；檢查 API base URL |

## 訓練

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `Training text is too short for block_size=N` | 視窗比資料集長 | 調低 `block_size` 或改用更大的資料集 |
| loss 變成 `nan` | learning rate 太高 | tiny 模型回到 `3e-3`、完整 SFT `5e-5`、LoRA `3e-4` |
| loss 幾乎不動 | learning rate 太低，或步數太少 | 一次調一個——Stage 05 |
| `Training has no trainable parameters` | 全部凍結且沒掛 adapter | 檢查 LoRA `target_modules`（`W_query`、`W_value`） |
| CUDA out of memory | GPT-2 的完整微調 | 調低 `block_size`、`batch_size` 維持 1，或改用 LoRA |
| 每步要好幾分鐘 | CPU | 見 [GPU runtime](gpu-runtime.zh-TW.md) |
| 微調後輸出變差 | learning rate 太高，或在小資料上步數太多 | 重新載入 base 模型，用較低的值重試 |

## 資料集與下載

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 資料集 `status` 不是 `ready` | 尚未下載 | `POST /training/datasets/{id}/prepare` |
| GPT-2 下載失敗 | 網路問題，或連不到 Hugging Face | 重試；`.complete` 標記代表不完整的下載不被信任 |
| 磁碟空間不足 | GPT-2 124M 約 500 MB | 維持使用 124M |
| builder 資料集是空的 | 從未 seed | `POST /training/dataset-builder/seed` |
| builder 範例消失 | `data/custom/` 被 git 忽略且被清掉 | 重新 seed；重要的請自行匯出 |

## 模型與 checkpoint

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `Unknown checkpoint_id` | id 錯誤，或檔案被刪 | `GET /checkpoints` |
| 載入時形狀不符 | 檔案寫出後模型設定改過 | 用 checkpoint 內存的設定載入 |
| `/models` 少了已載入的模型 | 載入時指定了不同的 `model_id` | 在 `POST /models/load` 明確傳入 `model_id` |
| checkpoint 清單是空的 | 還沒訓練過 | 先做 Stage 04 |

## 會話與串流

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 會話消失 | 記憶體儲存，API 重啟過 | 設計如此；Stage 15 |
| 回覆忽略歷史 | context 格式與訓練方式不符 | chat 微調用 `chat-transcript`、instruction 微調用 `instruction-request` |
| 模型以使用者身分回答 | base 模型且沒有 loss 遮罩 | 改用 `gpt2-chat-lora`；Stage 12 |
| 串流一次全部到達 | curl 緩衝 | 加上 `-N` |
| 取消回 404 | 任務已結束，或 id 錯誤 | 先輪詢任務 |

## 外部供應商

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| 供應商顯示未設定 | 環境變數在 API 啟動之後才設 | 先設變數，再啟動 uvicorn |
| 供應商回 401 | 金鑰錯誤或過期 | 換新金鑰；絕不提交進版控 |
| Ollama 連線被拒 | 沒啟動，或 base URL 錯 | 檢查 11434 埠 |
| `top_k` 好像被忽略 | 不會送到相容 OpenAI 的端點 | 預期行為；見[外部供應商支線](../tracks/external-models.zh-TW.md) |

## 還是卡住

1. `curl -s http://127.0.0.1:8000/health` — API 起來了嗎？在哪個裝置上？
2. `python -c "import sys; print(sys.executable)"` — 啟用的是正確的 Python 嗎？
3. 讀失敗任務的 `status` 與 `error` 欄位；它們帶著原始例外。
4. 重讀該階段的 **What to observe**——預期的數值通常就寫在那裡。
