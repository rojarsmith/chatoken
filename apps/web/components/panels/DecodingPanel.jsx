"use client";

import { useState } from "react";
import { LoaderCircle, Play } from "lucide-react";

import { api } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { escapeForDisplay, formatNumber } from "../../lib/format";

const MODES = [
  { id: "greedy", label: "Greedy", temperature: 0, topK: null, note: "argmax — deterministic" },
  { id: "focused", label: "Focused", temperature: 0.4, topK: 20, note: "limited variation" },
  { id: "creative", label: "Creative", temperature: 1.0, topK: 80, note: "wide candidate set" }
];

/**
 * Stage 03. Runs the same prompt twice so the learner can see for themselves
 * which settings are reproducible and which are not.
 */
export default function DecodingPanel() {
  const { apiBaseUrl, modelId } = useConsole();
  const [message, setMessage] = useState("Every effort moves you");
  const [maxNewTokens, setMaxNewTokens] = useState(24);
  const [temperature, setTemperature] = useState(0);
  const [topK, setTopK] = useState("");
  const [runs, setRuns] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function runTwice(settings) {
    setPending(true);
    setError(null);
    try {
      const body = {
        message,
        model_id: modelId,
        max_new_tokens: Number(maxNewTokens),
        temperature: settings.temperature,
        ...(settings.topK ? { top_k: settings.topK } : {})
      };
      const [first, second] = await Promise.all([
        api.chat(apiBaseUrl, body),
        api.chat(apiBaseUrl, body)
      ]);
      setRuns([
        {
          label: settings.label,
          note: settings.note,
          temperature: settings.temperature,
          topK: settings.topK,
          first,
          second,
          identical: first.reply === second.reply
        },
        ...runs
      ].slice(0, 4));
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="lx-controls">
        <div className="lx-field grow">
          <label htmlFor="lx-dec-message">Message</label>
          <input
            id="lx-dec-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="lx-field narrow">
          <label htmlFor="lx-dec-len">Max new tokens</label>
          <input
            id="lx-dec-len"
            type="number"
            min={1}
            max={200}
            value={maxNewTokens}
            onChange={(event) => setMaxNewTokens(event.target.value)}
          />
        </div>
      </div>

      <p style={{ marginTop: "16px" }}>
        Each button sends the <strong>same request twice</strong> and compares the two replies.
      </p>

      <div className="lx-controls">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className="lx-primary"
            disabled={pending || !message.trim()}
            onClick={() => runTwice(mode)}
          >
            {pending ? <LoaderCircle size={15} /> : <Play size={15} />} {mode.label}
          </button>
        ))}
      </div>

      {error ? <p className="lx-error">{error}</p> : null}

      {runs.map((run, index) => (
        <div key={`${run.label}-${index}`} style={{ marginTop: "16px" }}>
          <div className="lx-metrics">
            <Metric label="Mode" value={run.label} hint={run.note} />
            <Metric label="temperature" value={String(run.temperature)} />
            <Metric label="top_k" value={run.topK ? String(run.topK) : "none"} />
            <Metric
              label="Two runs"
              value={run.identical ? "identical" : "different"}
              hint={run.identical ? "no randomness" : "sampled"}
            />
          </div>
          <pre className="lx-code" style={{ marginTop: "10px" }}>
            run 1: {escapeForDisplay(run.first.reply) || "(empty)"}
            {"\n"}
            run 2: {escapeForDisplay(run.second.reply) || "(empty)"}
          </pre>
          <p className="lx-deepdive">
            generated {formatNumber(run.first.tokens_generated)} /{" "}
            {formatNumber(run.second.tokens_generated)} tokens — fewer than requested means an EOS
            id was sampled.
          </p>
        </div>
      ))}

      <details className="lx-advanced">
        <summary>Manual settings</summary>
        <div className="lx-controls">
          <div className="lx-field narrow">
            <label htmlFor="lx-dec-temp">temperature</label>
            <input
              id="lx-dec-temp"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
            />
          </div>
          <div className="lx-field narrow">
            <label htmlFor="lx-dec-topk">top_k</label>
            <input
              id="lx-dec-topk"
              type="number"
              min={1}
              max={200}
              placeholder="none"
              value={topK}
              onChange={(event) => setTopK(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="lx-secondary"
            disabled={pending}
            onClick={() =>
              runTwice({
                label: "Manual",
                note: "your settings",
                temperature: Number(temperature),
                topK: topK ? Number(topK) : null
              })
            }
          >
            Run twice
          </button>
        </div>
        <p className="lx-deepdive" style={{ marginTop: "10px" }}>
          Try <code>temperature 1.0</code> with <code>top_k 1</code>: the candidate set collapses
          to one, so sampling becomes deterministic again.
        </p>
      </details>
    </>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="lx-metric">
      <span>{label}</span>
      <b style={{ fontSize: value.length > 10 ? "14px" : "19px" }}>{value}</b>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
