from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

from apps.api.services.chat_service import ChatRequestData, ChatService
from llm_core.generation import (
    format_chat_transcript,
    format_instruction_prompt,
    trim_repeated_sentences,
)


@dataclass(frozen=True)
class ConversationCreateRequestData:
    title: str
    model_id: str
    system_prompt: str
    max_history_messages: int
    context_token_budget: int
    context_format: str
    max_new_tokens: int
    temperature: float
    top_k: int | None
    inference_mode: str


@dataclass(frozen=True)
class ConversationTurnRequestData:
    message: str
    model_id: str
    system_prompt: str
    max_history_messages: int
    context_token_budget: int
    context_format: str
    max_new_tokens: int
    temperature: float
    top_k: int | None
    inference_mode: str
    update_settings: bool = True


@dataclass
class ConversationMessage:
    message_id: str
    role: str
    content: str
    created_at: str
    model_id: str | None = None
    inference_mode: str | None = None
    context_format: str | None = None
    prompt_tokens: int | None = None
    tokens_generated: int | None = None


@dataclass
class ConversationSession:
    conversation_id: str
    title: str
    created_at: str
    updated_at: str
    settings: dict
    messages: list[ConversationMessage] = field(default_factory=list)


class ConversationService:
    def __init__(self, chat_service: ChatService) -> None:
        self._chat_service = chat_service
        self._lock = Lock()
        self._sessions: dict[str, ConversationSession] = {}

    def list_conversations(self) -> list[dict]:
        with self._lock:
            sessions = list(self._sessions.values())
        return [
            {
                "conversation_id": session.conversation_id,
                "title": session.title,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "settings": session.settings,
                "message_count": len(session.messages),
                "last_message": _message_to_dict(session.messages[-1])
                if session.messages
                else None,
            }
            for session in sorted(sessions, key=lambda item: item.updated_at, reverse=True)
        ]

    def create_conversation(self, request: ConversationCreateRequestData) -> dict:
        now = _utc_now()
        session = ConversationSession(
            conversation_id=str(uuid4()),
            title=request.title.strip() or "New conversation",
            created_at=now,
            updated_at=now,
            settings=_settings_from_create_request(request),
        )
        with self._lock:
            self._sessions[session.conversation_id] = session
        return self.get_conversation(session.conversation_id)

    def get_conversation(self, conversation_id: str) -> dict:
        session = self._get_session(conversation_id)
        return _session_to_dict(session)

    def delete_conversation(self, conversation_id: str) -> dict:
        with self._lock:
            if conversation_id not in self._sessions:
                raise ValueError(f"Unknown conversation_id: {conversation_id}")
            del self._sessions[conversation_id]
        return {"conversation_id": conversation_id, "deleted": True}

    def preview_context(
        self,
        conversation_id: str,
        request: ConversationTurnRequestData,
    ) -> dict:
        session = self._get_session(conversation_id)
        settings = _settings_from_turn_request(request, session.settings)
        pending_message = ConversationMessage(
            message_id="pending-user-message",
            role="user",
            content=request.message,
            created_at=_utc_now(),
        )
        return self._build_context_preview(session, settings, pending_message)

    def send_message(
        self,
        conversation_id: str,
        request: ConversationTurnRequestData,
    ) -> dict:
        with self._lock:
            session = self._sessions.get(conversation_id)
            if session is None:
                raise ValueError(f"Unknown conversation_id: {conversation_id}")

            if request.update_settings:
                session.settings = _settings_from_turn_request(request, session.settings)
            settings = dict(session.settings)
            now = _utc_now()
            user_message = ConversationMessage(
                message_id=str(uuid4()),
                role="user",
                content=request.message,
                created_at=now,
                model_id=settings["model_id"],
                inference_mode=settings["inference_mode"],
                context_format=settings["context_format"],
            )
            session.messages.append(user_message)
            session.updated_at = now

        preview = self._build_context_preview(session, settings, None)
        result = self._chat_service.generate_reply(
            ChatRequestData(
                message=preview["prompt"],
                model_id=settings["model_id"],
                max_new_tokens=settings["max_new_tokens"],
                temperature=settings["temperature"],
                top_k=settings["top_k"],
                include_prompt=False,
                prompt_style="raw",
                prompt_template=None,
                inference_mode=settings["inference_mode"],
            )
        )
        assistant_text = _clean_assistant_reply(result["reply"])
        if not assistant_text:
            assistant_text = result["reply"].strip()

        with self._lock:
            session = self._sessions[conversation_id]
            assistant_message = ConversationMessage(
                message_id=str(uuid4()),
                role="assistant",
                content=assistant_text,
                created_at=_utc_now(),
                model_id=result["model_id"],
                inference_mode=result["inference_mode"],
                context_format=settings["context_format"],
                prompt_tokens=result["prompt_tokens"],
                tokens_generated=result["tokens_generated"],
            )
            session.messages.append(assistant_message)
            session.updated_at = assistant_message.created_at
            updated_session = _session_to_dict(session)

        return {
            "conversation": updated_session,
            "context": preview,
            "result": {
                **result,
                "reply": assistant_text,
                "conversation_id": conversation_id,
                "user_message_id": user_message.message_id,
                "assistant_message_id": assistant_message.message_id,
            },
        }

    def _build_context_preview(
        self,
        session: ConversationSession,
        settings: dict,
        pending_message: ConversationMessage | None,
    ) -> dict:
        base_messages = [_message_to_dict(message) for message in session.messages]
        if pending_message is not None:
            base_messages.append(_message_to_dict(pending_message))

        selected_messages = _select_recent_messages(
            base_messages,
            settings["max_history_messages"],
        )
        prompt = _render_conversation_prompt(
            settings["system_prompt"],
            selected_messages,
            settings["context_format"],
        )
        prompt_tokens = self._count_prompt_tokens(settings["model_id"], prompt)

        omitted_by_budget = 0
        while (
            prompt_tokens > settings["context_token_budget"]
            and len(selected_messages) > 1
        ):
            selected_messages = selected_messages[1:]
            omitted_by_budget += 1
            prompt = _render_conversation_prompt(
                settings["system_prompt"],
                selected_messages,
                settings["context_format"],
            )
            prompt_tokens = self._count_prompt_tokens(settings["model_id"], prompt)

        omitted_by_history = max(0, len(base_messages) - len(_select_recent_messages(
            base_messages,
            settings["max_history_messages"],
        )))
        model_profile = self._chat_service.model_resource_profile(settings["model_id"])
        model_context_length = model_profile["context_length"]
        warnings = []
        if model_profile["state"] in {"random-untrained", "loaded-random"}:
            warnings.append(
                "This model is randomly initialized; repeated byte-like output is expected "
                "until it is trained or replaced by a checkpoint."
            )
        if model_profile["state"] == "loaded-pretrained" and settings["model_id"].startswith("gpt2-"):
            warnings.append(
                "Downloaded GPT-2 is a base next-token model, not a ChatGPT-style "
                "instruction/chat model. Use Instruction SFT or LoRA checkpoints for "
                "more direct answers."
            )
        if (
            settings["context_format"] == "chat-transcript"
            and model_profile["prompt_style"] == "instruction"
        ):
            warnings.append(
                "Chat transcript format bypasses this model's instruction prompt wrapper."
            )
        if prompt_tokens > settings["context_token_budget"]:
            warnings.append(
                "Context token budget is still exceeded because the latest message "
                "must stay in the prompt."
            )
        if prompt_tokens + settings["max_new_tokens"] > settings["context_token_budget"]:
            warnings.append(
                "Prompt plus requested answer length exceeds the selected context budget."
            )
        if prompt_tokens > model_context_length:
            warnings.append(
                "Rendered conversation is longer than the model context_length; "
                "the local model will only attend to the last context window."
            )
        if prompt_tokens + settings["max_new_tokens"] > model_context_length:
            warnings.append(
                "Rendered conversation plus answer length exceeds model context_length."
            )

        return {
            "conversation_id": session.conversation_id,
            "model_id": settings["model_id"],
            "prompt": prompt,
            "prompt_tokens": prompt_tokens,
            "model_context_length": model_context_length,
            "context_token_budget": settings["context_token_budget"],
            "remaining_context_tokens": max(
                0,
                settings["context_token_budget"] - prompt_tokens,
            ),
            "included_messages": selected_messages,
            "included_message_ids": [
                message["message_id"] for message in selected_messages
            ],
            "omitted_by_history": omitted_by_history,
            "omitted_by_token_budget": omitted_by_budget,
            "settings": settings,
            "warnings": warnings,
        }

    def _count_prompt_tokens(self, model_id: str, prompt: str) -> int:
        preview = self._chat_service.preview_prompt(
            ChatRequestData(
                message=prompt,
                model_id=model_id,
                max_new_tokens=1,
                temperature=0.0,
                top_k=None,
                include_prompt=False,
                prompt_style="raw",
                prompt_template=None,
                inference_mode="greedy",
            )
        )
        return int(preview["prompt_tokens"])

    def _get_session(self, conversation_id: str) -> ConversationSession:
        with self._lock:
            session = self._sessions.get(conversation_id)
            if session is None:
                raise ValueError(f"Unknown conversation_id: {conversation_id}")
            return ConversationSession(
                conversation_id=session.conversation_id,
                title=session.title,
                created_at=session.created_at,
                updated_at=session.updated_at,
                settings=dict(session.settings),
                messages=list(session.messages),
            )


def _settings_from_create_request(request: ConversationCreateRequestData) -> dict:
    return {
        "model_id": request.model_id,
        "system_prompt": request.system_prompt,
        "max_history_messages": request.max_history_messages,
        "context_token_budget": request.context_token_budget,
        "context_format": request.context_format,
        "max_new_tokens": request.max_new_tokens,
        "temperature": request.temperature,
        "top_k": request.top_k,
        "inference_mode": request.inference_mode,
    }


def _settings_from_turn_request(
    request: ConversationTurnRequestData,
    current: dict,
) -> dict:
    return {
        "model_id": request.model_id or current["model_id"],
        "system_prompt": request.system_prompt,
        "max_history_messages": request.max_history_messages,
        "context_token_budget": request.context_token_budget,
        "context_format": request.context_format,
        "max_new_tokens": request.max_new_tokens,
        "temperature": request.temperature,
        "top_k": request.top_k,
        "inference_mode": request.inference_mode,
    }


def _select_recent_messages(messages: list[dict], max_history_messages: int) -> list[dict]:
    if max_history_messages <= 0:
        return messages[-1:] if messages else []
    return messages[-max_history_messages:]


def _render_conversation_prompt(
    system_prompt: str,
    messages: list[dict],
    context_format: str,
) -> str:
    if context_format == "instruction-request":
        return _render_instruction_request_prompt(system_prompt, messages)

    return format_chat_transcript(
        system_prompt,
        messages,
        append_assistant_prompt=True,
    )


def _render_instruction_request_prompt(system_prompt: str, messages: list[dict]) -> str:
    latest_user = ""
    previous_messages = messages
    if messages and messages[-1]["role"] == "user":
        latest_user = messages[-1]["content"].strip()
        previous_messages = messages[:-1]
    else:
        for message in reversed(messages):
            if message["role"] == "user":
                latest_user = message["content"].strip()
                break

    sections = []
    if system_prompt.strip():
        sections.append(f"System instruction:\n{system_prompt.strip()}")
    if previous_messages:
        transcript = []
        for message in previous_messages:
            if message["role"] == "user":
                transcript.append(f"User: {message['content'].strip()}")
            elif message["role"] == "assistant":
                transcript.append(f"Assistant: {message['content'].strip()}")
        if transcript:
            sections.append("Conversation so far:\n" + "\n".join(transcript))
    if latest_user:
        sections.append(f"Latest user message:\n{latest_user}")
    sections.append(
        "Answer the latest user message as the assistant. Use the earlier turns "
        "as context when they are relevant."
    )
    return format_instruction_prompt("\n\n".join(sections)) + "\n\n### Response:"


def _clean_assistant_reply(reply: str) -> str:
    text = reply.strip()
    if text.startswith("### Response:"):
        text = text.removeprefix("### Response:").strip()
    for marker in (
        "\nUser:",
        "\nAssistant:",
        "\nSystem:",
        "\n### Instruction:",
        "\n### Input:",
        "\n### Response:",
    ):
        index = text.find(marker)
        if index >= 0:
            text = text[:index].strip()
    return trim_repeated_sentences(text)


def _session_to_dict(session: ConversationSession) -> dict:
    return {
        "conversation_id": session.conversation_id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "settings": session.settings,
        "messages": [_message_to_dict(message) for message in session.messages],
        "message_count": len(session.messages),
    }


def _message_to_dict(message: ConversationMessage) -> dict:
    return asdict(message)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
