"use client";

import { X } from "lucide-react";

const MODES = ["greedy", "focused", "creative", "manual"];
const FORMATS = ["chat-transcript", "instruction-request"];

/** The knobs from Stages 09 and 15, in the places a product would put them. */
export default function SettingsDrawer({ settings, onChange, onClose }) {
  const set = (patch) => onChange({ ...settings, ...patch });

  return (
    <>
      <div className="ax-scrim" onClick={onClose} />
      <aside className="ax-drawer">
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings">
            <X size={16} />
          </button>
        </header>

        <label className="ax-field">
          <span>System prompt</span>
          <textarea
            value={settings.system_prompt}
            rows={3}
            onChange={(event) => set({ system_prompt: event.target.value })}
          />
          <small>Inserted before every turn. Base models tend to ignore it.</small>
        </label>

        <label className="ax-field">
          <span>Context format</span>
          <select
            value={settings.context_format}
            onChange={(event) => set({ context_format: event.target.value })}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <small>
            Match how the model was trained: <code>chat-transcript</code> for{" "}
            <code>gpt2-chat-lora</code>, <code>instruction-request</code> for instruction-tuned
            checkpoints.
          </small>
        </label>

        <label className="ax-field">
          <span>Inference mode</span>
          <select
            value={settings.inference_mode}
            onChange={(event) => set({ inference_mode: event.target.value })}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <small>greedy is reproducible; creative samples widely.</small>
        </label>

        <div className="ax-field-row">
          <label className="ax-field">
            <span>Max new tokens</span>
            <input
              type="number"
              min={1}
              max={200}
              value={settings.max_new_tokens}
              onChange={(event) => set({ max_new_tokens: Number(event.target.value) })}
            />
          </label>
          <label className="ax-field">
            <span>History messages</span>
            <input
              type="number"
              min={1}
              max={40}
              value={settings.max_history_messages}
              onChange={(event) => set({ max_history_messages: Number(event.target.value) })}
            />
          </label>
        </div>

        <label className="ax-field">
          <span>Context token budget</span>
          <input
            type="number"
            min={1}
            max={8192}
            value={settings.context_token_budget}
            onChange={(event) => set({ context_token_budget: Number(event.target.value) })}
          />
          <small>
            Your policy for how much history to render. It cannot exceed the model&apos;s own
            context length — that limit is architectural.
          </small>
        </label>
      </aside>
    </>
  );
}
