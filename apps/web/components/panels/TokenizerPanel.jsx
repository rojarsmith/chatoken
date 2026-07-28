"use client";

import { useMemo, useState } from "react";

import { api } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction } from "../../lib/hooks";
import {
  BYTE_EOS_ID,
  BYTE_VOCAB_SIZE,
  byteDecode,
  byteEncode,
  formatNumber,
  renderPrompt
} from "../../lib/format";

const PRESETS = [
  "Every effort moves you",
  "每一分努力",
  "Explain what a model checkpoint is in one sentence."
];

/**
 * Stage 01. The byte tokenizer runs in the browser because it is trivially
 * reproducible: llm_core.tokenizer.ByteTokenizer is exactly UTF-8 bytes with
 * 256 reserved for EOS. The API is used only to confirm the real prompt cost.
 */
export default function TokenizerPanel() {
  const { apiBaseUrl, modelId } = useConsole();
  const [text, setText] = useState(PRESETS[0]);

  const ids = useMemo(() => byteEncode(text), [text]);
  const roundTrip = useMemo(() => byteDecode(ids), [ids]);
  const promptIds = useMemo(() => byteEncode(renderPrompt(text, "chat")), [text]);

  const preview = useAction((body) => api.promptPreview(apiBaseUrl, body));

  return (
    <>
      <div className="lx-controls">
        <div className="lx-field grow">
          <label htmlFor="lx-tok-text">Text to encode</label>
          <input
            id="lx-tok-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          className="lx-primary"
          disabled={preview.pending || !text.trim()}
          onClick={() => preview.run({ message: text, model_id: modelId })}
        >
          Ask the API
        </button>
      </div>

      <div className="lx-controls" style={{ marginTop: "10px" }}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="lx-secondary"
            onClick={() => setText(preset)}
          >
            {preset.length > 26 ? `${preset.slice(0, 26)}…` : preset}
          </button>
        ))}
      </div>

      <div className="lx-metrics" style={{ marginTop: "16px" }}>
        <Metric label="Characters" value={formatNumber([...text].length)} />
        <Metric label="Tokens (bytes)" value={formatNumber(ids.length)} />
        <Metric
          label="Chat prompt tokens"
          value={formatNumber(promptIds.length)}
          hint={`template costs ${promptIds.length - ids.length}`}
        />
        <Metric label="Vocabulary" value={formatNumber(BYTE_VOCAB_SIZE)} hint={`EOS = ${BYTE_EOS_ID}`} />
      </div>

      <p style={{ marginTop: "16px" }}>
        <strong>Token ids</strong> — each box is one UTF-8 byte, with the character it came from.
      </p>
      <div className="lx-ids">
        {ids.slice(0, 120).map((id, index) => (
          <span key={`${id}-${index}`} className="lx-id">
            {id}
            <small>{byteDecode([id]) || "·"}</small>
          </span>
        ))}
        {ids.length > 120 ? <span className="lx-id">…</span> : null}
      </div>

      <p style={{ marginTop: "16px" }}>
        <strong>Decoded back</strong> — the round trip is lossless.
      </p>
      <pre className="lx-code">{roundTrip || "(empty)"}</pre>

      <details className="lx-advanced">
        <summary>The prompt the model actually receives</summary>
        <pre className="lx-code" style={{ marginTop: "12px" }}>
          {renderPrompt(text, "chat")}
        </pre>
        {preview.error ? <p className="lx-error">{preview.error}</p> : null}
        {preview.result ? (
          <div className="lx-metrics" style={{ marginTop: "12px" }}>
            <Metric label="API prompt_tokens" value={formatNumber(preview.result.prompt_tokens)} />
            <Metric label="Context length" value={formatNumber(preview.result.context_length)} />
            <Metric
              label="Remaining context"
              value={formatNumber(preview.result.remaining_context_tokens)}
            />
            <Metric label="Prompt style" value={preview.result.effective_prompt_style} />
          </div>
        ) : (
          <p className="lx-deepdive" style={{ marginTop: "12px" }}>
            Press <strong>Ask the API</strong> to compare this browser-side count against the
            server&apos;s own tokenizer.
          </p>
        )}
        {preview.result?.warnings?.length ? (
          <p className="lx-note">{preview.result.warnings.join(" ")}</p>
        ) : null}
      </details>
    </>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="lx-metric">
      <span>{label}</span>
      <b>{value}</b>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
