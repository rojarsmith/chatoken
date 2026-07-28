from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol


class Tokenizer(Protocol):
    eos_id: int
    vocab_size: int
    name: str

    def encode(self, text: str, add_eos: bool = False) -> list[int]:
        ...

    def decode(self, token_ids: list[int]) -> str:
        ...


class ByteTokenizer:
    """A dependency-free tokenizer for the first learning loop.

    It maps UTF-8 bytes to token ids 0..255 and reserves 256 as EOS.
    This is intentionally simple so the first model/API loop can run
    before introducing tiktoken and GPT-2 compatibility.
    """

    eos_id = 256
    vocab_size = 257
    name = "byte"

    def encode(self, text: str, add_eos: bool = False) -> list[int]:
        token_ids = list(text.encode("utf-8"))
        if add_eos:
            token_ids.append(self.eos_id)
        return token_ids

    def decode(self, token_ids: list[int]) -> str:
        byte_values = bytes(token_id for token_id in token_ids if 0 <= token_id <= 255)
        return byte_values.decode("utf-8", errors="backslashreplace")


class GPT2Tokenizer:
    eos_id = 50256
    vocab_size = 50257
    name = "gpt2"

    def __init__(self, assets_dir: Path | str | None = None) -> None:
        import tiktoken

        local_assets_dir = _gpt2_assets_dir(assets_dir)
        if local_assets_dir is not None:
            from tiktoken.load import data_gym_to_mergeable_bpe_ranks
            from tiktoken_ext.openai_public import ENDOFTEXT, r50k_pat_str

            mergeable_ranks = data_gym_to_mergeable_bpe_ranks(
                vocab_bpe_file=str(local_assets_dir / "merges.txt"),
                encoder_json_file=str(local_assets_dir / "vocab.json"),
            )
            self._encoding = tiktoken.Encoding(
                name="gpt2-local",
                explicit_n_vocab=self.vocab_size,
                pat_str=r50k_pat_str,
                mergeable_ranks=mergeable_ranks,
                special_tokens={ENDOFTEXT: self.eos_id},
            )
            return

        self._encoding = tiktoken.get_encoding("gpt2")

    def encode(self, text: str, add_eos: bool = False) -> list[int]:
        token_ids = self._encoding.encode(text, allowed_special={"<|endoftext|>"})
        if add_eos:
            token_ids.append(self.eos_id)
        return token_ids

    def decode(self, token_ids: list[int]) -> str:
        return self._encoding.decode(token_ids)


def tokenizer_for_name(name: str) -> Tokenizer:
    if name == "byte":
        return ByteTokenizer()
    if name == "gpt2":
        return GPT2Tokenizer()
    raise ValueError(f"Unsupported tokenizer: {name}")


def _gpt2_assets_dir(assets_dir: Path | str | None = None) -> Path | None:
    candidates: list[Path] = []
    if assets_dir is not None:
        candidates.append(Path(assets_dir))
    env_dir = os.environ.get("CHATOKEN_GPT2_TOKENIZER_DIR")
    if env_dir:
        candidates.append(Path(env_dir))

    cwd = Path.cwd()
    candidates.extend(
        [
            cwd / "models" / "downloaded" / "gpt2" / "124M",
            *[
                parent / "models" / "downloaded" / "gpt2" / "124M"
                for parent in cwd.parents
            ],
        ]
    )

    for candidate in candidates:
        if (candidate / "vocab.json").exists() and (candidate / "merges.txt").exists():
            return candidate
    return None
