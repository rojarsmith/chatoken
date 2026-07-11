from __future__ import annotations

from concurrent.futures import CancelledError
from dataclasses import dataclass
from typing import Callable

import torch
from torch.utils.data import DataLoader, Dataset

from llm_core.generation import (
    format_chat_transcript,
    format_instruction_prompt,
    generate,
    prepare_chat_prompt,
)
from llm_core.tokenizer import Tokenizer


@dataclass(frozen=True)
class TrainingConfig:
    max_steps: int = 80
    batch_size: int = 4
    block_size: int = 32
    stride: int = 1
    learning_rate: float = 3e-3
    eval_every: int = 10
    sample_prompt: str = "Every effort moves you"
    prompt_style: str = "chat"
    sample_tokens: int = 24
    seed: int = 123


class TokenDataset(Dataset):
    def __init__(self, text: str, tokenizer: Tokenizer, block_size: int, stride: int = 1) -> None:
        if block_size < 2:
            raise ValueError("block_size must be at least 2")
        token_ids = tokenizer.encode(text)
        if len(token_ids) <= block_size:
            raise ValueError(
                f"Training text is too short for block_size={block_size}. "
                f"Need more than {block_size} tokens."
            )

        self.input_ids: list[torch.Tensor] = []
        self.target_ids: list[torch.Tensor] = []
        for i in range(0, len(token_ids) - block_size, stride):
            input_chunk = token_ids[i : i + block_size]
            target_chunk = token_ids[i + 1 : i + block_size + 1]
            self.input_ids.append(torch.tensor(input_chunk, dtype=torch.long))
            self.target_ids.append(torch.tensor(target_chunk, dtype=torch.long))

    def __len__(self) -> int:
        return len(self.input_ids)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        return self.input_ids[index], self.target_ids[index]


class InstructionDataset(Dataset):
    def __init__(
        self,
        entries: list[dict],
        tokenizer: Tokenizer,
        max_length: int,
    ) -> None:
        self.encoded_texts: list[list[int]] = []
        for entry in entries:
            input_text = entry.get("input", "")
            prompt = format_instruction_prompt(entry["instruction"], input_text)
            full_text = f"{prompt}\n\n### Response:\n{entry['output']}"
            token_ids = tokenizer.encode(full_text)
            if len(token_ids) > max_length:
                token_ids = token_ids[:max_length]
            if len(token_ids) >= 2:
                self.encoded_texts.append(token_ids)

        if not self.encoded_texts:
            raise ValueError("Instruction dataset has no examples with at least 2 tokens.")

    def __len__(self) -> int:
        return len(self.encoded_texts)

    def __getitem__(self, index: int) -> list[int]:
        return self.encoded_texts[index]


class ChatTranscriptDataset(Dataset):
    def __init__(
        self,
        entries: list[dict],
        tokenizer: Tokenizer,
        max_length: int,
    ) -> None:
        self.samples: list[tuple[torch.Tensor, torch.Tensor]] = []
        for entry in entries:
            for prompt, response in _chat_training_pairs(entry):
                prompt_ids = tokenizer.encode(prompt)
                response_ids = tokenizer.encode(" " + response.strip(), add_eos=True)
                if len(response_ids) >= max_length:
                    response_ids = response_ids[:max_length]
                    prompt_ids = []
                else:
                    prompt_budget = max(1, max_length - len(response_ids))
                    prompt_ids = prompt_ids[-prompt_budget:]

                token_ids = prompt_ids + response_ids
                if len(token_ids) < 2:
                    continue

                input_ids = torch.tensor(token_ids[:-1], dtype=torch.long)
                target_ids = torch.tensor(token_ids[1:], dtype=torch.long)
                ignore_until = max(0, len(prompt_ids) - 1)
                if ignore_until:
                    target_ids[:ignore_until] = -100
                self.samples.append((input_ids, target_ids))

        if not self.samples:
            raise ValueError("Chat dataset has no assistant responses to train on.")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        return self.samples[index]


def train_tiny_language_model(
    *,
    model: torch.nn.Module,
    tokenizer: Tokenizer,
    text: str,
    device: torch.device,
    config: TrainingConfig,
    progress_callback: Callable[[dict], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> dict:
    torch.manual_seed(config.seed)
    model.to(device)
    model.train()

    dataset = TokenDataset(
        text=text,
        tokenizer=tokenizer,
        block_size=config.block_size,
        stride=config.stride,
    )
    generator = torch.Generator()
    generator.manual_seed(config.seed)
    loader = DataLoader(
        dataset,
        batch_size=config.batch_size,
        shuffle=True,
        drop_last=len(dataset) >= config.batch_size,
        generator=generator,
    )
    trainable_parameters = [param for param in model.parameters() if param.requires_grad]
    if not trainable_parameters:
        raise ValueError("Training has no trainable parameters.")
    optimizer = torch.optim.AdamW(trainable_parameters, lr=config.learning_rate)

    losses: list[dict] = []
    tokens_seen = 0
    step = 0

    while step < config.max_steps:
        _raise_if_cancelled(should_cancel)
        for input_batch, target_batch in loader:
            _raise_if_cancelled(should_cancel)
            input_batch = input_batch.to(device)
            target_batch = target_batch.to(device)

            optimizer.zero_grad(set_to_none=True)
            logits = model(input_batch)
            loss = torch.nn.functional.cross_entropy(
                logits.flatten(0, 1),
                target_batch.flatten(),
            )
            loss.backward()
            optimizer.step()

            step += 1
            tokens_seen += input_batch.numel()

            if step == 1 or step % config.eval_every == 0 or step == config.max_steps:
                event = {
                    "step": step,
                    "max_steps": config.max_steps,
                    "loss": round(float(loss.item()), 6),
                    "tokens_seen": tokens_seen,
                }
                losses.append(event)
                if progress_callback is not None:
                    progress_callback(event)

            if step >= config.max_steps:
                break

    model.eval()
    sample_text = generate_sample(
        model=model,
        tokenizer=tokenizer,
        prompt=config.sample_prompt,
        device=device,
        context_size=model.pos_emb.num_embeddings,
        max_new_tokens=config.sample_tokens,
        prompt_style=config.prompt_style,
    )
    summary = {
        "max_steps": config.max_steps,
        "batch_size": config.batch_size,
        "block_size": config.block_size,
        "learning_rate": config.learning_rate,
        "tokens_seen": tokens_seen,
        "losses": losses,
        "final_loss": losses[-1]["loss"] if losses else None,
        "sample_prompt": config.sample_prompt,
        "prompt_style": config.prompt_style,
        "sample_text": sample_text,
        "dataset_tokens": len(tokenizer.encode(text)),
    }
    return summary


def train_instruction_language_model(
    *,
    model: torch.nn.Module,
    tokenizer: Tokenizer,
    entries: list[dict],
    device: torch.device,
    config: TrainingConfig,
    progress_callback: Callable[[dict], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> dict:
    torch.manual_seed(config.seed)
    model.to(device)
    model.train()

    dataset = InstructionDataset(
        entries=entries,
        tokenizer=tokenizer,
        max_length=config.block_size,
    )
    generator = torch.Generator()
    generator.manual_seed(config.seed)
    loader = DataLoader(
        dataset,
        batch_size=config.batch_size,
        shuffle=True,
        drop_last=len(dataset) >= config.batch_size,
        generator=generator,
        collate_fn=lambda batch: _collate_instruction_batch(
            batch,
            pad_token_id=tokenizer.eos_id,
            device=device,
        ),
    )
    trainable_parameters = [param for param in model.parameters() if param.requires_grad]
    if not trainable_parameters:
        raise ValueError("Training has no trainable parameters.")
    optimizer = torch.optim.AdamW(trainable_parameters, lr=config.learning_rate, weight_decay=0.1)

    losses: list[dict] = []
    tokens_seen = 0
    step = 0

    while step < config.max_steps:
        _raise_if_cancelled(should_cancel)
        for input_batch, target_batch in loader:
            _raise_if_cancelled(should_cancel)
            optimizer.zero_grad(set_to_none=True)
            logits = model(input_batch)
            loss = torch.nn.functional.cross_entropy(
                logits.flatten(0, 1),
                target_batch.flatten(),
                ignore_index=-100,
            )
            loss.backward()
            optimizer.step()

            step += 1
            tokens_seen += int((target_batch != -100).sum().item())

            if step == 1 or step % config.eval_every == 0 or step == config.max_steps:
                event = {
                    "step": step,
                    "max_steps": config.max_steps,
                    "loss": round(float(loss.item()), 6),
                    "tokens_seen": tokens_seen,
                }
                losses.append(event)
                if progress_callback is not None:
                    progress_callback(event)

            if step >= config.max_steps:
                break

    model.eval()
    sample_text = generate_sample(
        model=model,
        tokenizer=tokenizer,
        prompt=config.sample_prompt,
        device=device,
        context_size=model.pos_emb.num_embeddings,
        max_new_tokens=config.sample_tokens,
        prompt_style=config.prompt_style,
    )
    return {
        "max_steps": config.max_steps,
        "batch_size": config.batch_size,
        "block_size": config.block_size,
        "learning_rate": config.learning_rate,
        "tokens_seen": tokens_seen,
        "losses": losses,
        "final_loss": losses[-1]["loss"] if losses else None,
        "sample_prompt": config.sample_prompt,
        "prompt_style": config.prompt_style,
        "sample_text": sample_text,
        "dataset_tokens": sum(len(item) for item in dataset.encoded_texts),
    }


def train_chat_language_model(
    *,
    model: torch.nn.Module,
    tokenizer: Tokenizer,
    entries: list[dict],
    device: torch.device,
    config: TrainingConfig,
    progress_callback: Callable[[dict], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> dict:
    torch.manual_seed(config.seed)
    model.to(device)
    model.train()

    dataset = ChatTranscriptDataset(
        entries=entries,
        tokenizer=tokenizer,
        max_length=config.block_size,
    )
    generator = torch.Generator()
    generator.manual_seed(config.seed)
    loader = DataLoader(
        dataset,
        batch_size=config.batch_size,
        shuffle=True,
        drop_last=len(dataset) >= config.batch_size,
        generator=generator,
        collate_fn=lambda batch: _collate_tensor_batch(
            batch,
            pad_token_id=tokenizer.eos_id,
            device=device,
        ),
    )
    trainable_parameters = [param for param in model.parameters() if param.requires_grad]
    if not trainable_parameters:
        raise ValueError("Training has no trainable parameters.")
    optimizer = torch.optim.AdamW(trainable_parameters, lr=config.learning_rate, weight_decay=0.1)

    losses: list[dict] = []
    tokens_seen = 0
    step = 0

    while step < config.max_steps:
        _raise_if_cancelled(should_cancel)
        for input_batch, target_batch in loader:
            _raise_if_cancelled(should_cancel)
            optimizer.zero_grad(set_to_none=True)
            logits = model(input_batch)
            loss = torch.nn.functional.cross_entropy(
                logits.flatten(0, 1),
                target_batch.flatten(),
                ignore_index=-100,
            )
            loss.backward()
            optimizer.step()

            step += 1
            tokens_seen += int((target_batch != -100).sum().item())

            if step == 1 or step % config.eval_every == 0 or step == config.max_steps:
                event = {
                    "step": step,
                    "max_steps": config.max_steps,
                    "loss": round(float(loss.item()), 6),
                    "tokens_seen": tokens_seen,
                }
                losses.append(event)
                if progress_callback is not None:
                    progress_callback(event)

            if step >= config.max_steps:
                break

    model.eval()
    sample_text = generate_sample(
        model=model,
        tokenizer=tokenizer,
        prompt=config.sample_prompt,
        device=device,
        context_size=model.pos_emb.num_embeddings,
        max_new_tokens=config.sample_tokens,
        prompt_style=config.prompt_style,
    )
    return {
        "max_steps": config.max_steps,
        "batch_size": config.batch_size,
        "block_size": config.block_size,
        "learning_rate": config.learning_rate,
        "tokens_seen": tokens_seen,
        "losses": losses,
        "final_loss": losses[-1]["loss"] if losses else None,
        "sample_prompt": config.sample_prompt,
        "prompt_style": config.prompt_style,
        "sample_text": sample_text,
        "dataset_tokens": sum(int((target != -100).sum().item()) for _, target in dataset.samples),
        "chat_training_pairs": len(dataset),
    }


def generate_sample(
    *,
    model: torch.nn.Module,
    tokenizer: Tokenizer,
    prompt: str,
    device: torch.device,
    context_size: int,
    max_new_tokens: int,
    prompt_style: str = "chat",
) -> str:
    chat_prompt = prepare_chat_prompt(prompt, prompt_style)
    input_ids = tokenizer.encode(chat_prompt)
    idx = torch.tensor(input_ids, dtype=torch.long, device=device).unsqueeze(0)
    output = generate(
        model=model,
        idx=idx,
        max_new_tokens=max_new_tokens,
        context_size=context_size,
        temperature=0.0,
        top_k=None,
        eos_id=tokenizer.eos_id,
    )
    output_ids = output.squeeze(0).tolist()
    generated_ids = output_ids[len(input_ids) :]
    return _clean_generated_sample(tokenizer.decode(generated_ids), config_style=prompt_style)


def _clean_generated_sample(text: str, *, config_style: str) -> str:
    sample = text.strip()
    if config_style == "chat":
        for marker in ("\nUser:", "\nAssistant:", "\nSystem:"):
            if marker in sample:
                sample = sample.split(marker, 1)[0].strip()
        return sample

    if config_style != "instruction":
        return sample

    sample = sample.replace("### Response:", "", 1).strip()
    for marker in ("\n\n### Instruction:", "\n\n### Input:", "\n\n###"):
        if marker in sample:
            sample = sample.split(marker, 1)[0].strip()
    return sample


def _raise_if_cancelled(should_cancel: Callable[[], bool] | None) -> None:
    if should_cancel is not None and should_cancel():
        raise CancelledError("Training cancelled.")


def _collate_instruction_batch(
    batch: list[list[int]],
    *,
    pad_token_id: int,
    device: torch.device,
) -> tuple[torch.Tensor, torch.Tensor]:
    batch_max_length = max(len(item) + 1 for item in batch)
    inputs: list[torch.Tensor] = []
    targets: list[torch.Tensor] = []

    for item in batch:
        padded = item + [pad_token_id]
        padded += [pad_token_id] * (batch_max_length - len(padded))
        input_ids = torch.tensor(padded[:-1], dtype=torch.long)
        target_ids = torch.tensor(padded[1:], dtype=torch.long)
        mask = target_ids == pad_token_id
        indices = torch.nonzero(mask, as_tuple=False).flatten()
        if indices.numel() > 1:
            target_ids[indices[1:]] = -100
        inputs.append(input_ids)
        targets.append(target_ids)

    return torch.stack(inputs).to(device), torch.stack(targets).to(device)


def _collate_tensor_batch(
    batch: list[tuple[torch.Tensor, torch.Tensor]],
    *,
    pad_token_id: int,
    device: torch.device,
) -> tuple[torch.Tensor, torch.Tensor]:
    batch_max_length = max(input_ids.numel() for input_ids, _ in batch)
    inputs: list[torch.Tensor] = []
    targets: list[torch.Tensor] = []

    for input_ids, target_ids in batch:
        pad_length = batch_max_length - input_ids.numel()
        if pad_length:
            input_ids = torch.cat(
                (
                    input_ids,
                    torch.full((pad_length,), pad_token_id, dtype=torch.long),
                )
            )
            target_ids = torch.cat(
                (
                    target_ids,
                    torch.full((pad_length,), -100, dtype=torch.long),
                )
            )
        inputs.append(input_ids)
        targets.append(target_ids)

    return torch.stack(inputs).to(device), torch.stack(targets).to(device)


def _chat_training_pairs(entry: dict) -> list[tuple[str, str]]:
    messages = entry.get("messages")
    if not isinstance(messages, list):
        return []

    pairs: list[tuple[str, str]] = []
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
            continue
        if role == "assistant":
            prompt = format_chat_transcript(
                system_prompt,
                history,
                append_assistant_prompt=True,
            )
            if prompt:
                pairs.append((prompt, content))
            history.append({"role": role, "content": content})
        elif role == "user":
            history.append({"role": role, "content": content})

    return pairs
