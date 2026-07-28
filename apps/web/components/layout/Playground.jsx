"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

import { api } from "../../lib/api";
import { useAction } from "../../lib/hooks";
import { escapeForDisplay, formatNumber } from "../../lib/format";

/**
 * Always-available chat against the currently selected model.
 * This replaces the old `Chat` tab: every stage can end with
 * "talk to what you just made" without navigating away.
 */
export default function Playground({ apiBaseUrl, models, modelId, onModelIdChange }) {
  const [message, setMessage] = useState("Every effort moves you");

  const send = useAction((body) => api.chat(apiBaseUrl, body));

  const reply = send.result;
  const looksLikeEscapes = reply?.reply && /\\x[0-9a-f]{2}/i.test(escapeForDisplay(reply.reply));

  return (
    <aside className="lx-playground">
      <h2>Playground</h2>

      <div className="lx-field">
        <label htmlFor="lx-pg-model">Active model</label>
        <select
          id="lx-pg-model"
          value={modelId}
          onChange={(event) => onModelIdChange(event.target.value)}
        >
          {models.length === 0 ? <option value={modelId}>{modelId}</option> : null}
          {models.map((model) => (
            <option key={model.model_id} value={model.model_id}>
              {model.model_id}
            </option>
          ))}
        </select>
      </div>

      <div className="lx-field">
        <label htmlFor="lx-pg-message">Message</label>
        <textarea
          id="lx-pg-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      <button
        type="button"
        className="lx-primary"
        disabled={send.pending || !message.trim()}
        onClick={() =>
          send.run({ message, model_id: modelId, max_new_tokens: 32, temperature: 0 })
        }
      >
        {send.pending ? <LoaderCircle size={15} /> : <Send size={15} />} Send
      </button>

      {send.error ? <p className="lx-error">{send.error}</p> : null}

      {reply ? (
        <>
          <pre className="lx-code lx-playground-out">{escapeForDisplay(reply.reply) || "(empty)"}</pre>
          <div className="lx-playground-meta">
            <span>prompt {formatNumber(reply.prompt_tokens)} tok</span>
            <span>· generated {formatNumber(reply.tokens_generated)} tok</span>
            {reply.prompt_style ? <span>· {reply.prompt_style}</span> : null}
          </div>
          {looksLikeEscapes ? (
            <p className="lx-note">
              Escaped bytes mean the model produced ids that are not valid UTF-8. Expected from an
              untrained model — see Stage 01 and Stage 03.
            </p>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
