"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrainCircuit, Cpu, MessageSquarePlus, Settings2, Trash2, Zap } from "lucide-react";

import { api } from "../../lib/api";
import { useApiBaseUrl, useDevice, useModelId, useModels, useRuntime } from "../../lib/hooks";
import Composer from "./Composer";
import MessageList from "./MessageList";
import SettingsDrawer from "./SettingsDrawer";

const DEFAULT_SETTINGS = {
  system_prompt: "You are Chatoken, a concise assistant.",
  max_history_messages: 8,
  context_token_budget: 512,
  context_format: "chat-transcript",
  max_new_tokens: 80,
  temperature: 0,
  inference_mode: "greedy"
};

export default function Assistant() {
  const [apiBaseUrl] = useApiBaseUrl();
  const { runtime, status, refresh: refreshRuntime } = useRuntime(apiBaseUrl);
  const { models } = useModels(apiBaseUrl);
  const [modelId, setModelId] = useModelId();
  const { device } = useDevice(apiBaseUrl, refreshRuntime);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [contextInfo, setContextInfo] = useState(null);
  const threadRef = useRef(null);


  // A model id persists across API restarts, but loaded models do not. Fall back
  // to something that actually exists rather than pointing at a ghost.
  useEffect(() => {
    if (models.length === 0) return;
    if (models.some((model) => model.model_id === modelId)) return;
    setModelId(models[0].model_id);
  }, [models, modelId, setModelId]);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.conversations(apiBaseUrl));
    } catch {
      setSessions([]);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (status === "online") loadSessions();
  }, [status, loadSessions]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function openSession(id) {
    setActiveId(id);
    setError(null);
    try {
      const conversation = await api.conversation(apiBaseUrl, id);
      setMessages(conversation.messages ?? []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function newSession() {
    setError(null);
    try {
      const created = await api.createConversation(apiBaseUrl, {
        title: "New chat",
        model_id: modelId,
        ...settings
      });
      setActiveId(created.conversation_id);
      setMessages([]);
      setContextInfo(null);
      loadSessions();
      return created.conversation_id;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  async function removeSession(id) {
    try {
      await api.deleteConversation(apiBaseUrl, id);
      if (id === activeId) {
        setActiveId(null);
        setMessages([]);
      }
      loadSessions();
    } catch (err) {
      setError(err.message);
    }
  }

  async function send(text) {
    const id = activeId ?? (await newSession());
    if (!id) return;

    setPending(true);
    setError(null);
    // Show the user's turn immediately; the API echoes it back on success.
    setMessages((current) => [
      ...current,
      { message_id: `local-${Date.now()}`, role: "user", content: text }
    ]);

    try {
      const body = { message: text, model_id: modelId, ...settings };
      const result = await api.sendConversationMessage(apiBaseUrl, id, body);
      setMessages(result.conversation?.messages ?? []);
      setContextInfo(result.context ?? null);
      loadSessions();
    } catch (err) {
      setError(err.message);
      setMessages((current) => current.filter((m) => !String(m.message_id).startsWith("local-")));
    } finally {
      setPending(false);
    }
  }

  const activeModel = models.find((m) => m.model_id === modelId);
  const onCuda = device?.device === "cuda";

  // A transcript is just text. If earlier replies came from a different model,
  // the current one reads them as "what the assistant says here" and imitates
  // them — an untrained model's escaped bytes will poison GPT-2's answers.
  const foreignModels = [
    ...new Set(
      messages
        .filter((m) => m.role === "assistant" && m.model_id && m.model_id !== modelId)
        .map((m) => m.model_id)
    )
  ];

  return (
    <div className="ax-shell">
      <aside className="ax-sidebar">
        <Link href="/" className="ax-brand">
          <BrainCircuit size={22} color="var(--blue)" />
          <span>
            <strong>Chatoken</strong>
            <small>your assistant</small>
          </span>
        </Link>

        <button type="button" className="ax-new" onClick={newSession}>
          <MessageSquarePlus size={15} /> New chat
        </button>

        <div className="ax-sessions">
          {sessions.length === 0 ? (
            <p className="ax-empty">No conversations yet.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.conversation_id}
                className={`ax-session${session.conversation_id === activeId ? " active" : ""}`}
              >
                <button type="button" onClick={() => openSession(session.conversation_id)}>
                  {session.title || "Untitled"}
                  <small>{session.message_count ?? session.messages?.length ?? 0} messages</small>
                </button>
                <button
                  type="button"
                  className="ax-session-delete"
                  title="Delete conversation"
                  onClick={() => removeSession(session.conversation_id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="ax-sidebar-foot">
          <Link href="/">← Back to the course</Link>
          <p>
            Sessions live in the API&apos;s memory and clear when it restarts — Stage 15
            explains why.
          </p>
        </div>
      </aside>

      <main className="ax-main">
        <header className="ax-topbar">
          <div className="ax-model">
            <label htmlFor="ax-model-select">Model</label>
            <select
              id="ax-model-select"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
            >
              {models.length === 0 ? <option value={modelId}>{modelId}</option> : null}
              {models.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))}
            </select>
          </div>

          {activeModel ? (
            <span className="ax-chip">
              {activeModel.parameters.toLocaleString()} params · {activeModel.context_length} ctx
            </span>
          ) : null}

          <span className={`ax-chip ${onCuda ? "good" : ""}`}>
            {onCuda ? <Zap size={13} /> : <Cpu size={13} />}
            {onCuda ? device?.device_name || "CUDA" : "CPU"}
          </span>

          <span className="ax-spacer" />

          <span className={`ax-chip ${status === "online" ? "good" : "bad"}`}>
            {status === "online" ? "API online" : "API offline"}
          </span>

          <button type="button" className="ax-icon" onClick={() => setShowSettings(true)}>
            <Settings2 size={16} />
          </button>
        </header>

        <div className="ax-thread" ref={threadRef}>
          <MessageList
            messages={messages}
            pending={pending}
            modelId={modelId}
            activeModel={activeModel}
          />
        </div>

        {error ? <p className="ax-error">{error}</p> : null}

        {foreignModels.length > 0 ? (
          <div className="ax-mixed">
            <div>
              <b>This chat already contains replies from {foreignModels.join(", ")}.</b>
              <span>
                {modelId} is shown those replies as &ldquo;what the assistant says here&rdquo; and
                will imitate them — that is next-token prediction working correctly, not a fault.
                Start a new chat to judge {modelId} on its own.
              </span>
            </div>
            <button type="button" onClick={newSession}>
              New chat with {modelId}
            </button>
          </div>
        ) : null}

        {contextInfo ? (
          <p className="ax-context">
            Context sent: {contextInfo.prompt_tokens} tokens of{" "}
            {contextInfo.model_context_length} available
            {contextInfo.omitted_by_history?.length || contextInfo.omitted_by_token_budget?.length
              ? ` · ${(contextInfo.omitted_by_history?.length ?? 0) + (contextInfo.omitted_by_token_budget?.length ?? 0)} older messages dropped`
              : ""}
          </p>
        ) : null}

        <Composer disabled={pending || status !== "online"} pending={pending} onSend={send} />
      </main>

      {showSettings ? (
        <SettingsDrawer
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      ) : null}
    </div>
  );
}
