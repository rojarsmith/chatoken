"""Reading datasets for display — previews, split counts, and example shapes.

Extracted from training_service.py in Phase 5. Nothing here trains anything; it
exists so the console can describe a dataset before you commit to a run.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from apps.api.services.dataset_registry import BUILDER_SEED_EXAMPLES
from llm_core.generation import format_chat_transcript, format_instruction_prompt


def _preview_text(text: str, limit: int = 220) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3] + "..."


def _seed_builder_examples() -> list[dict]:
    now = _utc_now()
    return [
        _normalize_builder_example(
            {
                **example,
                "example_id": str(uuid4()),
                "created_at": now,
                "updated_at": now,
            }
        )
        for example in BUILDER_SEED_EXAMPLES
    ]


def _normalize_builder_example(raw_example: dict) -> dict:
    now = _utc_now()
    split = str(raw_example.get("split", "train")).strip().lower()
    if split not in {"train", "eval"}:
        raise ValueError("Builder example split must be 'train' or 'eval'.")

    instruction = str(raw_example.get("instruction", "")).strip()
    output = str(raw_example.get("output", "")).strip()
    input_text = str(raw_example.get("input", "")).strip()
    if not instruction:
        raise ValueError("Builder example instruction is required.")
    if not output:
        raise ValueError("Builder example output is required.")

    return {
        "example_id": str(
            raw_example.get("example_id") or raw_example.get("id") or uuid4()
        ),
        "split": split,
        "instruction": instruction,
        "input": input_text,
        "output": output,
        "created_at": str(raw_example.get("created_at") or now),
        "updated_at": str(raw_example.get("updated_at") or now),
    }


def _instruction_split_counts(entries: object) -> dict:
    counts = {"train": 0, "eval": 0}
    if not isinstance(entries, list):
        return counts

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        split = str(entry.get("split", "train")).strip().lower()
        if split == "eval":
            counts["eval"] += 1
        else:
            counts["train"] += 1
    return counts


def _chat_split_counts(entries: object) -> dict:
    counts = {"train": 0, "eval": 0}
    if not isinstance(entries, list):
        return counts

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        split = str(entry.get("split", "train")).strip().lower()
        if split == "eval":
            counts["eval"] += 1
        else:
            counts["train"] += 1
    return counts


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _instruction_dataset_metadata(text: str) -> dict:
    template = (
        "Below is an instruction that describes a task. "
        "Write a response that appropriately completes the request."
        "\n\n### Instruction:\n{instruction}"
        "\n\n### Input:\n{input}"
        "\n\n### Response:\n{output}"
    )
    if not text:
        return {
            "example_count": 0,
            "instruction_template": template,
            "instruction_example": None,
            "formatted_prompt_preview": "",
            "target_response_preview": "",
            "train_examples": 0,
            "eval_examples": 0,
        }

    try:
        entries = json.loads(text)
    except json.JSONDecodeError:
        return {
            "example_count": 0,
            "instruction_template": template,
            "instruction_example": None,
            "formatted_prompt_preview": "",
            "target_response_preview": "",
            "train_examples": 0,
            "eval_examples": 0,
        }

    split_counts = _instruction_split_counts(entries)
    example = _first_instruction_example(entries)
    if example is None:
        return {
            "example_count": len(entries) if isinstance(entries, list) else 0,
            "instruction_template": template,
            "instruction_example": None,
            "formatted_prompt_preview": "",
            "target_response_preview": "",
            "train_examples": split_counts["train"],
            "eval_examples": split_counts["eval"],
        }

    input_text = example.get("input", "")
    formatted_prompt = format_instruction_prompt(example["instruction"], input_text)
    return {
        "example_count": len(entries),
        "instruction_template": template,
        "instruction_example": {
            "instruction": example["instruction"],
            "input": input_text,
            "output": example["output"],
        },
        "formatted_prompt_preview": formatted_prompt + "\n\n### Response:",
        "target_response_preview": example["output"],
        "train_examples": split_counts["train"],
        "eval_examples": split_counts["eval"],
    }


def _first_instruction_example(entries: object) -> dict | None:
    if not isinstance(entries, list):
        return None
    for entry in entries:
        if (
            isinstance(entry, dict)
            and isinstance(entry.get("instruction"), str)
            and isinstance(entry.get("output"), str)
        ):
            return entry
    return None


def _chat_dataset_metadata(text: str) -> dict:
    template = (
        "System: {system}\n"
        "User: {user message}\n"
        "Assistant: {assistant response}\n"
        "User: {latest user message}\n"
        "Assistant:"
    )
    empty = {
        "example_count": 0,
        "chat_template": template,
        "chat_example": None,
        "formatted_prompt_preview": "",
        "target_response_preview": "",
        "chat_training_pairs": 0,
        "train_examples": 0,
        "eval_examples": 0,
    }
    if not text:
        return empty

    try:
        entries = json.loads(text)
    except json.JSONDecodeError:
        return empty
    if not isinstance(entries, list):
        return empty

    split_counts = _chat_split_counts(entries)
    example = _first_chat_example(entries)
    training_pairs = sum(_count_assistant_turns(entry) for entry in entries)
    if example is None:
        return {
            **empty,
            "example_count": len(entries),
            "chat_training_pairs": training_pairs,
            "train_examples": split_counts["train"],
            "eval_examples": split_counts["eval"],
        }

    prompt, target = _first_chat_pair(example)
    return {
        "example_count": len(entries),
        "chat_template": template,
        "chat_example": {
            "system": str(example.get("system", "")),
            "messages": example.get("messages", []),
        },
        "formatted_prompt_preview": prompt,
        "target_response_preview": target,
        "chat_training_pairs": training_pairs,
        "train_examples": split_counts["train"],
        "eval_examples": split_counts["eval"],
    }


def _first_chat_example(entries: object) -> dict | None:
    if not isinstance(entries, list):
        return None
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if _first_chat_pair(entry)[0]:
            return entry
    return None


def _first_chat_pair(entry: dict) -> tuple[str, str]:
    messages = entry.get("messages")
    if not isinstance(messages, list):
        return "", ""

    history: list[dict] = []
    system_prompt = str(entry.get("system", "")).strip()
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role", "")).strip().lower()
        content = str(message.get("content", "")).strip()
        if not content:
            continue
        if role == "system":
            system_prompt = content
        elif role == "user":
            history.append({"role": "user", "content": content})
        elif role == "assistant":
            prompt = format_chat_transcript(
                system_prompt,
                history,
                append_assistant_prompt=True,
            )
            return prompt, content
    return "", ""


def _count_assistant_turns(entry: object) -> int:
    if not isinstance(entry, dict) or not isinstance(entry.get("messages"), list):
        return 0
    return sum(
        1
        for message in entry["messages"]
        if isinstance(message, dict)
        and str(message.get("role", "")).strip().lower() == "assistant"
        and str(message.get("content", "")).strip()
    )
