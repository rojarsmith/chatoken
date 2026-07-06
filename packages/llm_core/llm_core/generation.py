from __future__ import annotations

import torch


BUILT_IN_PROMPT_TEMPLATES = {
    "raw": "{message}",
    "chat": "User: {message}\nAssistant:",
    "instruction": (
        "Below is an instruction that describes a task. "
        "Write a response that appropriately completes the request."
        "\n\n### Instruction:\n{message}"
        "\n\n### Response:"
    ),
}


def prepare_chat_prompt(
    message: str,
    prompt_style: str = "chat",
    prompt_template: str | None = None,
) -> str:
    if prompt_style == "custom":
        if not prompt_template:
            raise ValueError("prompt_template is required when prompt_style='custom'.")
        return render_prompt_template(prompt_template, message)
    if prompt_style == "raw":
        return message
    if prompt_style == "instruction":
        return format_instruction_prompt(message) + "\n\n### Response:"
    return f"User: {message}\nAssistant:"


def render_prompt_template(template: str, message: str) -> str:
    if "{message}" not in template and "{instruction}" not in template:
        raise ValueError("Prompt template must contain {message} or {instruction}.")
    return (
        template.replace("{message}", message)
        .replace("{instruction}", message)
        .replace("{input}", "")
    )


def format_instruction_prompt(instruction: str, input_text: str = "") -> str:
    prompt = (
        "Below is an instruction that describes a task. "
        "Write a response that appropriately completes the request."
        f"\n\n### Instruction:\n{instruction}"
    )
    if input_text:
        prompt += f"\n\n### Input:\n{input_text}"
    return prompt


def generate(
    model: torch.nn.Module,
    idx: torch.Tensor,
    max_new_tokens: int,
    context_size: int,
    temperature: float = 0.0,
    top_k: int | None = None,
    eos_id: int | None = None,
) -> torch.Tensor:
    model.eval()

    for _ in range(max_new_tokens):
        idx_cond = idx[:, -context_size:]

        with torch.no_grad():
            logits = model(idx_cond)

        logits = logits[:, -1, :]

        if top_k is not None:
            top_logits, _ = torch.topk(logits, min(top_k, logits.shape[-1]))
            min_val = top_logits[:, -1]
            logits = torch.where(
                logits < min_val,
                torch.tensor(float("-inf"), device=logits.device),
                logits,
            )

        if temperature > 0.0:
            logits = logits / temperature
            probs = torch.softmax(logits, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)
        else:
            idx_next = torch.argmax(logits, dim=-1, keepdim=True)

        if eos_id is not None and idx_next.item() == eos_id:
            break

        idx = torch.cat((idx, idx_next), dim=1)

    return idx
