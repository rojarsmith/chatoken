"use client";

import { LoaderCircle } from "lucide-react";

import { escapeForDisplay } from "../../lib/format";

/** The thread. Deliberately honest about which model produced each reply. */
export default function MessageList({ messages, pending, modelId, activeModel }) {
  if (messages.length === 0 && !pending) {
    return (
      <div className="ax-welcome">
        <h1>Talk to the model you trained</h1>
        <p>
          This is the same <code>GPTModel</code> from Stage 02, the same generation loop from
          Stage 03, and the same session logic from Stage 15 — assembled as a product.
        </p>
        {activeModel?.model_id === "random-tiny-byte" ? (
          <p className="ax-hint">
            You are talking to <code>random-tiny-byte</code>: 136,704 untrained parameters. It
            will reply with escaped bytes, which is correct. Load a checkpoint from Stage 07, or
            train <code>gpt2-chat-lora</code> in Stage 12, then pick it above.
          </p>
        ) : null}
        <div className="ax-starters">
          {["Who are you?", "Explain what a model checkpoint is in one sentence.", "My name is Rojar. Please remember it."].map(
            (s) => (
              <span key={s}>{s}</span>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => (
        <article key={message.message_id} className={`ax-msg ${message.role}`}>
          <div className="ax-avatar">{message.role === "user" ? "You" : "AI"}</div>
          <div className="ax-bubble">
            <p>{escapeForDisplay(message.content)}</p>
            {message.role === "assistant" && message.model_id ? (
              <span className="ax-msg-model">{message.model_id}</span>
            ) : null}
          </div>
        </article>
      ))}

      {pending ? (
        <article className="ax-msg assistant">
          <div className="ax-avatar">AI</div>
          <div className="ax-bubble ax-thinking">
            <LoaderCircle size={15} />
            <span>{modelId} is generating…</span>
          </div>
        </article>
      ) : null}
    </>
  );
}
