"use client";

import { useState } from "react";
import { LoaderCircle, Pencil, Play } from "lucide-react";

import { api } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { escapeForDisplay, formatNumber } from "../../lib/format";
import { ApiOfflineNote, Metric, Metrics } from "../ui/Bits";

const STYLES = ["raw", "chat", "instruction"];
const MODES = ["greedy", "focused", "creative"];

/** Stage 09. Four templates and three decoding policies over identical weights. */
export default function PromptFormatPanel() {
  const { apiBaseUrl, status, modelId } = useConsole();
  const [message, setMessage] = useState("Explain what a model checkpoint is in one sentence.");
  const [template, setTemplate] = useState("Question: {message}\nAnswer:");
  const [style, setStyle] = useState("instruction");
  const [mode, setMode] = useState("greedy");

  const [previews, setPreviews] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function compareTemplates() {
    setPending(true);
    setError(null);
    try {
      const results = await Promise.all([
        ...STYLES.map((item) =>
          api
            .promptPreview(apiBaseUrl, { message, model_id: modelId, prompt_style: item })
            .then((value) => ({ style: item, ...value }))
        ),
        api
          .promptPreview(apiBaseUrl, {
            message,
            model_id: modelId,
            prompt_style: "custom",
            prompt_template: template
          })
          .then((value) => ({ style: "custom", ...value }))
      ]);
      setPreviews(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const body = {
        message,
        model_id: modelId,
        max_new_tokens: 48,
        inference_mode: mode,
        prompt_style: style,
        ...(style === "custom" ? { prompt_template: template } : {})
      };
      setGenerated(await api.chat(apiBaseUrl, body));
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p>
        Nothing is trained here. The same weights are wrapped in four templates so you can see
        what formatting costs and what it changes.
      </p>

      <ApiOfflineNote status={status} />

      <div className="lx-controls">
        <div className="lx-field grow">
          <label htmlFor="lx-pf-message">Message</label>
          <input
            id="lx-pf-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          className="lx-primary"
          disabled={pending || status !== "online" || !message.trim()}
          onClick={compareTemplates}
        >
          {pending ? <LoaderCircle size={15} /> : <Pencil size={15} />} Compare all four templates
        </button>
      </div>

      {error ? <p className="lx-error">{error}</p> : null}

      {previews ? (
        <>
          <table className="lx-table" style={{ marginTop: "14px" }}>
            <thead>
              <tr>
                <th>Style</th>
                <th className="num">Prompt tokens</th>
                <th className="num">Remaining context</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {previews.map((preview) => (
                <tr key={preview.style}>
                  <td>
                    <code>{preview.style}</code>
                    {preview.style === previews[0]?.effective_prompt_style ? "" : ""}
                  </td>
                  <td className="num">{formatNumber(preview.prompt_tokens)}</td>
                  <td className="num">{formatNumber(preview.remaining_context_tokens)}</td>
                  <td>{preview.warnings?.length ? preview.warnings.join(" ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Metrics>
            <Metric label="Model" value={modelId} />
            <Metric label="model_default resolves to" value={previews[0]?.model_prompt_style} />
            <Metric label="Context length" value={previews[0]?.context_length} />
          </Metrics>

          <span className="lx-block-label" style={{ marginTop: "14px" }}>
            The exact text that gets tokenized
          </span>
          {previews.map((preview) => (
            <div key={`p-${preview.style}`} style={{ marginBottom: "10px" }}>
              <p className="lx-deepdive" style={{ marginBottom: "4px" }}>
                <code>{preview.style}</code> — {formatNumber(preview.prompt_tokens)} tokens
              </p>
              <pre className="lx-code">{preview.prompt}</pre>
            </div>
          ))}
        </>
      ) : null}

      <details className="lx-advanced">
        <summary>Generate with one style and one decoding policy</summary>
        <div className="lx-controls" style={{ marginTop: "12px" }}>
          <div className="lx-field narrow">
            <label htmlFor="lx-pf-style">prompt_style</label>
            <select
              id="lx-pf-style"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
            >
              {[...STYLES, "custom", "model-default"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="lx-field narrow">
            <label htmlFor="lx-pf-mode">inference_mode</label>
            <select id="lx-pf-mode" value={mode} onChange={(event) => setMode(event.target.value)}>
              {MODES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="lx-secondary"
            disabled={pending || status !== "online"}
            onClick={generate}
          >
            <Play size={13} /> Generate
          </button>
        </div>

        <div className="lx-field" style={{ marginTop: "12px" }}>
          <label htmlFor="lx-pf-template">Custom template (needs {"{message}"})</label>
          <input
            id="lx-pf-template"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            spellCheck={false}
          />
        </div>

        {generated ? (
          <>
            <Metrics>
              <Metric label="Effective style" value={generated.prompt_style} />
              <Metric label="Mode" value={generated.inference_mode} />
              <Metric label="temperature" value={String(generated.temperature)} />
              <Metric label="top_k" value={generated.top_k ? String(generated.top_k) : "none"} />
            </Metrics>
            <pre className="lx-code" style={{ marginTop: "10px" }}>
              {escapeForDisplay(generated.reply) || "(empty)"}
            </pre>
          </>
        ) : null}
      </details>

      <p className="lx-note">
        Prompting redistributes ability a model already has. If the model is GPT-2 base, no
        template turns continuation into instruction following — that needs Stage 10.
      </p>
    </>
  );
}
