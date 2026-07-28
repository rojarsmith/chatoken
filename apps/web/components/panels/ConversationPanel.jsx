"use client";

import { useState } from "react";
import { Eye, LoaderCircle, Send } from "lucide-react";

import { api } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction } from "../../lib/hooks";
import { escapeForDisplay } from "../../lib/format";
import { ApiOfflineNote, Metric, Metrics } from "../ui/Bits";

const SETTINGS = {
  system_prompt: "You are a concise assistant.",
  max_history_messages: 8,
  context_token_budget: 256,
  context_format: "chat-transcript",
  max_new_tokens: 24,
  temperature: 0,
  inference_mode: "greedy"
};

/** Stage 15. The model is stateless; this panel shows what the app re-sends. */
export default function ConversationPanel() {
  const { apiBaseUrl, status, modelId } = useConsole();
  const [conversationId, setConversationId] = useState(null);
  const [message, setMessage] = useState("My name is Rojar. Please remember it.");
  const [format, setFormat] = useState("chat-transcript");
  const [turns, setTurns] = useState([]);

  const create = useAction(() =>
    api.createConversation(apiBaseUrl, { title: "Stage 15", model_id: modelId, ...SETTINGS })
  );
  const preview = useAction((id, body) => api.previewConversationContext(apiBaseUrl, id, body));
  const send = useAction((id, body) => api.sendConversationMessage(apiBaseUrl, id, body));

  const body = { message, model_id: modelId, ...SETTINGS, context_format: format };
  const ctx = preview.result;

  async function ensureSession() {
    if (conversationId) return conversationId;
    const created = await create.run();
    if (!created) return null;
    setConversationId(created.conversation_id);
    return created.conversation_id;
  }

  return (
    <>
      <p>
        Nothing you have built remembers anything. Everything that feels like memory is the
        application re-sending the history on every turn — and two separate limits decide how
        much survives.
      </p>

      <ApiOfflineNote status={status} />

      <div className="lx-controls">
        <div className="lx-field grow">
          <label htmlFor="lx-cv-message">Message</label>
          <input
            id="lx-cv-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
        <div className="lx-field narrow">
          <label htmlFor="lx-cv-format">context_format</label>
          <select id="lx-cv-format" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="chat-transcript">chat-transcript</option>
            <option value="instruction-request">instruction-request</option>
          </select>
        </div>
      </div>

      <div className="lx-controls" style={{ marginTop: "12px" }}>
        <button
          type="button"
          className="lx-primary"
          disabled={preview.pending || status !== "online"}
          onClick={async () => {
            const id = await ensureSession();
            if (id) preview.run(id, body);
          }}
        >
          {preview.pending ? <LoaderCircle size={15} /> : <Eye size={15} />} Preview context
        </button>
        <button
          type="button"
          className="lx-secondary"
          disabled={send.pending || status !== "online"}
          onClick={async () => {
            const id = await ensureSession();
            if (!id) return;
            const result = await send.run(id, body);
            if (result) {
              setTurns((current) => [
                ...current,
                { user: message, assistant: result.result?.reply ?? "" }
              ]);
              setMessage("What is my name?");
              preview.setResult(null);
            }
          }}
        >
          <Send size={13} /> Send turn
        </button>
        {conversationId ? (
          <span className="lx-pill">session {conversationId.slice(0, 8)}</span>
        ) : null}
      </div>

      {create.error ? <p className="lx-error">{create.error}</p> : null}
      {send.error ? <p className="lx-error">{send.error}</p> : null}
      {preview.error ? <p className="lx-error">{preview.error}</p> : null}

      {ctx ? (
        <>
          <Metrics>
            <Metric label="Prompt tokens" value={ctx.prompt_tokens} />
            <Metric
              label="Model context_length"
              value={ctx.model_context_length}
              hint="architecture limit"
            />
            <Metric
              label="App token budget"
              value={ctx.context_token_budget}
              hint="your policy"
            />
            <Metric label="Dropped by history" value={ctx.omitted_by_history?.length ?? 0} />
            <Metric label="Dropped by budget" value={ctx.omitted_by_token_budget?.length ?? 0} />
          </Metrics>

          <span className="lx-block-label" style={{ marginTop: "14px" }}>
            The exact transcript the model receives
          </span>
          <pre className="lx-code">{ctx.prompt}</pre>

          {ctx.warnings?.length ? (
            <p className="lx-note">{ctx.warnings.join(" ")}</p>
          ) : null}
        </>
      ) : null}

      {turns.length ? (
        <>
          <span className="lx-block-label" style={{ marginTop: "16px" }}>
            Session so far
          </span>
          {turns.map((turn, index) => (
            <div key={index} style={{ marginBottom: "8px" }}>
              <p className="lx-deepdive">User: {turn.user}</p>
              <pre className="lx-code">{escapeForDisplay(turn.assistant) || "(empty)"}</pre>
            </div>
          ))}
        </>
      ) : null}

      <p className="lx-note">
        Raising <code>max_history_messages</code> does not raise <code>context_length</code>.
        Application policy cannot exceed architecture — try it and watch the warning persist.
        Sessions live in process memory and vanish when the API restarts.
      </p>
    </>
  );
}
