# Reference · Setup

[English](setup.md) | [繁體中文](setup.zh-TW.md)

[Course index](../README.md)

Everything the course assumes is already working. Do this once.

## Requirements

- Windows, using **Command Prompt (`cmd.exe`)** — not PowerShell, not MSYS2.
- **Windows CPython 3.11, 3.12, or 3.13.** Not 3.14: PyTorch wheels are unavailable for it in
  this setup.
- Node.js 18 or newer, for the web console.
- An NVIDIA GPU is optional for Part 1 and Part 2, and strongly recommended from Stage 10.

Check which Python `cmd.exe` will use:

```cmd
where python
python --version
python -c "import sys; raise SystemExit(0 if (3, 11) <= sys.version_info[:2] < (3, 14) else 'Use Python 3.11, 3.12, or 3.13 for this project')"
```

## Create the virtual environment

Every Python command in this course runs inside the project-local `.venv`.

```cmd
python -m venv .venv
.venv\Scripts\activate.bat

python -m pip install --upgrade pip
python -c "import sys; print(sys.executable); print(sys.version)"
python -m pip install -e . -r apps\api\requirements.txt
```

After activation, `python` and `pip` must resolve inside `.venv`. Verify with
`python -c "import sys; print(sys.executable)"` — the path must contain your project folder.

### Recreate it if the Python version was wrong

```cmd
if defined VIRTUAL_ENV call deactivate
if exist .venv rmdir /s /q .venv

python -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -e . -r apps\api\requirements.txt
```

## Start the API

```cmd
python -m uvicorn apps.api.main:app --reload --port 8000
```

Confirm it is alive and see which device it chose:

```cmd
curl -s http://127.0.0.1:8000/health
```

## Start the web console

In a second Command Prompt:

```cmd
cd apps\web
npm install
npm run dev
```

Then open `http://127.0.0.1:3000`.

## Confirm the whole path works

With `.venv` active, this runs the model end to end without any server:

```cmd
python scripts\smoke_chat.py --message "Every effort moves you" --max-new-tokens 24
```

Output that looks like escaped bytes is **correct**. The model is untrained.
[Stage 01](../stages/01-tokens.md) explains why.

## Run the tests

The API has a contract test suite that pins every endpoint and response shape.
Run it before and after any backend change:

```cmd
python -m pip install -e .[dev]
python -m pytest
```

Tests that create checkpoints or experiment records restore the previous state
afterwards, so running them never pollutes your own training history.

## Where things are written

| Path | Contents | In git |
| --- | --- | --- |
| `models/checkpoints/` | Trained model files | no |
| `models/downloaded/` | GPT-2 weights and tokenizer assets | no |
| `models/experiments/` | Training run log | no |
| `data/tiny/`, `data/small/`, `data/medium/`, `data/chat/` | Shipped datasets | yes |
| `data/external/` | Downloaded datasets | no |
| `data/custom/` | Your Dataset Builder examples | no |

A fresh clone therefore has no models and no experiment history. That is expected — the course
produces them.

## Next

Start at [Stage 01 · Tokens](../stages/01-tokens.md), or read the
[course index](../README.md) first.

For CUDA, see [GPU runtime](gpu-runtime.md). When something breaks, see
[troubleshooting](troubleshooting.md).
