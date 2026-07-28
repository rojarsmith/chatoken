"""The dataset ladder, as declarative data.

Extracted from training_service.py in Phase 5. Every rung of the course's
dataset ladder is described here — its file, its recommended settings, and the
prompts used for before/after comparison — with no training logic attached.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


DEFAULT_COMPARISON_PROMPT = "Every effort moves you"
BUILDER_DATASET_ID = "instruction-builder"
CHAT_SFT_DATASET_ID = "chat-sft-lora"
THE_VERDICT_URL = (
    "https://raw.githubusercontent.com/rasbt/"
    "LLMs-from-scratch/main/ch02/01_main-chapter-code/the-verdict.txt"
)
INSTRUCTION_DATA_URL = (
    "https://raw.githubusercontent.com/rasbt/"
    "LLMs-from-scratch/main/ch07/01_main-chapter-code/instruction-data.json"
)
BUILDER_SEED_EXAMPLES = [
    {
        "split": "train",
        "instruction": "Explain what a model checkpoint is in one sentence.",
        "input": "",
        "output": (
            "A model checkpoint is a saved snapshot of model weights and "
            "training metadata that can be loaded later."
        ),
    },
    {
        "split": "train",
        "instruction": (
            "Convert the active sentence to passive: The chef cooks the meal "
            "every day."
        ),
        "input": "",
        "output": "The meal is cooked by the chef every day.",
    },
    {
        "split": "eval",
        "instruction": (
            "Summarize why splitting data into train and eval examples is useful."
        ),
        "input": "",
        "output": (
            "Train examples update the model, while eval examples help inspect "
            "whether the model generalizes beyond the data it memorized."
        ),
    },
]




@dataclass(frozen=True)
class DatasetSpec:
    dataset_id: str
    tier: str
    label: str
    path: Path
    description: str
    recommended_steps: int
    recommended_batch_size: int
    recommended_block_size: int
    recommended_learning_rate: float
    recommended_base_model_id: str
    comparison_prompt: str
    dataset_probe_prompt: str
    output_model_id: str
    training_objective: str = "text"
    prompt_style: str = "chat"
    learning_stage: str = "from-scratch"
    learning_stage_label: str = "From Scratch"
    learning_goal: str = "Train a tiny model from random weights."
    source_url: str | None = None



def build_dataset_registry(project_root: Path) -> dict[str, DatasetSpec]:
    """Every dataset the course trains on, keyed by dataset_id."""
    return {
        "every-effort": DatasetSpec(
            dataset_id="every-effort",
            tier="tiny",
            label="Tiny repeated phrase",
            path=project_root / "data" / "tiny" / "every-effort.txt",
            description="The shortest repeated dataset. It should overfit quickly.",
            recommended_steps=80,
            recommended_batch_size=4,
            recommended_block_size=32,
            recommended_learning_rate=3e-3,
            recommended_base_model_id="random-tiny-byte",
            comparison_prompt=DEFAULT_COMPARISON_PROMPT,
            dataset_probe_prompt="Every effort moves you",
            output_model_id="trained-tiny-byte",
            learning_goal=(
                "Start with a tiny random model and overfit the shortest dataset."
            ),
        ),
        "every-effort-expanded": DatasetSpec(
            dataset_id="every-effort-expanded",
            tier="small",
            label="Small phrase ladder",
            path=project_root / "data" / "small" / "every-effort-expanded.txt",
            description="A small set of related prompt/answer pairs with more variety.",
            recommended_steps=140,
            recommended_batch_size=4,
            recommended_block_size=32,
            recommended_learning_rate=3e-3,
            recommended_base_model_id="random-tiny-byte",
            comparison_prompt=DEFAULT_COMPARISON_PROMPT,
            dataset_probe_prompt="Small steps compound",
            output_model_id="trained-small-byte",
            learning_goal=(
                "Increase dataset variety while still training from random weights."
            ),
        ),
        "learning-dialogues": DatasetSpec(
            dataset_id="learning-dialogues",
            tier="medium",
            label="Medium learning dialogues",
            path=project_root / "data" / "medium" / "learning-dialogues.txt",
            description="A larger teaching dataset about loss, checkpoints, and overfitting.",
            recommended_steps=220,
            recommended_batch_size=4,
            recommended_block_size=32,
            recommended_learning_rate=3e-3,
            recommended_base_model_id="random-tiny-byte",
            comparison_prompt=DEFAULT_COMPARISON_PROMPT,
            dataset_probe_prompt="What does training do",
            output_model_id="trained-medium-byte",
            learning_goal=(
                "Use more examples to compare loss and generated behavior."
            ),
        ),
        "the-verdict": DatasetSpec(
            dataset_id="the-verdict",
            tier="larger",
            label="The Verdict",
            path=project_root / "data" / "external" / "the-verdict.txt",
            description=(
                "A larger raw-text dataset from the reference LLM-from-scratch project."
            ),
            recommended_steps=320,
            recommended_batch_size=4,
            recommended_block_size=64,
            recommended_learning_rate=3e-3,
            recommended_base_model_id="random-tiny-byte",
            comparison_prompt="I had always thought Jack Gisburn",
            dataset_probe_prompt="I had always thought Jack Gisburn",
            output_model_id="trained-verdict-byte",
            training_objective="raw-text",
            prompt_style="raw",
            learning_stage="raw-text",
            learning_stage_label="Raw Text Pretraining",
            learning_goal=(
                "Train next-token continuation on a larger raw text file."
            ),
            source_url=THE_VERDICT_URL,
        ),
        "instruction-following": DatasetSpec(
            dataset_id="instruction-following",
            tier="instruction",
            label="Instruction following",
            path=project_root / "data" / "external" / "instruction-data.json",
            description=(
                "Instruction/response data from the reference project Chapter 7."
            ),
            recommended_steps=20,
            recommended_batch_size=1,
            recommended_block_size=256,
            recommended_learning_rate=5e-5,
            recommended_base_model_id="gpt2-124M",
            comparison_prompt="Explain what a model checkpoint is in one sentence.",
            dataset_probe_prompt="Convert the active sentence to passive: The chef cooks the meal every day.",
            output_model_id="gpt2-instruct-finetuned",
            training_objective="instruction-sft",
            prompt_style="instruction",
            learning_stage="instruction",
            learning_stage_label="Instruction SFT",
            learning_goal=(
                "Fine-tune downloaded GPT-2 on instruction/response examples."
            ),
            source_url=INSTRUCTION_DATA_URL,
        ),
        "instruction-lora": DatasetSpec(
            dataset_id="instruction-lora",
            tier="peft",
            label="LoRA instruction tuning",
            path=project_root / "data" / "external" / "instruction-data.json",
            description=(
                "Instruction/response data with frozen GPT-2 and trainable LoRA adapters."
            ),
            recommended_steps=20,
            recommended_batch_size=1,
            recommended_block_size=256,
            recommended_learning_rate=3e-4,
            recommended_base_model_id="gpt2-124M",
            comparison_prompt="Explain what a model checkpoint is in one sentence.",
            dataset_probe_prompt="Convert the active sentence to passive: The chef cooks the meal every day.",
            output_model_id="gpt2-instruct-lora",
            training_objective="instruction-lora",
            prompt_style="instruction",
            learning_stage="lora",
            learning_stage_label="LoRA / PEFT",
            learning_goal=(
                "Freeze GPT-2 and train low-rank attention adapters."
            ),
            source_url=INSTRUCTION_DATA_URL,
        ),
        CHAT_SFT_DATASET_ID: DatasetSpec(
            dataset_id=CHAT_SFT_DATASET_ID,
            tier="chat",
            label="Minimal chat SFT",
            path=project_root / "data" / "chat" / "chat-sft-mini.json",
            description=(
                "Small multi-turn chat transcripts for a first ChatGPT-like "
                "conversation checkpoint."
            ),
            recommended_steps=240,
            recommended_batch_size=1,
            recommended_block_size=384,
            recommended_learning_rate=3e-4,
            recommended_base_model_id="gpt2-124M",
            comparison_prompt="who are you?",
            dataset_probe_prompt="What is my name?",
            output_model_id="gpt2-chat-lora",
            training_objective="chat-lora",
            prompt_style="chat",
            learning_stage="chat-sft",
            learning_stage_label="Chat SFT",
            learning_goal=(
                "Fine-tune GPT-2 with LoRA on multi-turn chat transcripts so "
                "Conversation can answer from session context."
            ),
        ),
        BUILDER_DATASET_ID: DatasetSpec(
            dataset_id=BUILDER_DATASET_ID,
            tier="custom",
            label="Dataset builder",
            path=project_root / "data" / "custom" / "instruction-builder.json",
            description="Editable instruction examples created from the Web UI.",
            recommended_steps=20,
            recommended_batch_size=1,
            recommended_block_size=256,
            recommended_learning_rate=5e-5,
            recommended_base_model_id="gpt2-124M",
            comparison_prompt="Explain what a model checkpoint is in one sentence.",
            dataset_probe_prompt=(
                "Summarize why splitting data into train and eval examples is useful."
            ),
            output_model_id="gpt2-builder-finetuned",
            training_objective="instruction-sft",
            prompt_style="instruction",
            learning_stage="dataset-builder",
            learning_stage_label="Dataset Builder",
            learning_goal=(
                "Build custom train/eval instruction examples before fine-tuning GPT-2."
            ),
        ),
    }
