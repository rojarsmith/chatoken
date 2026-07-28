"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows, LoaderCircle } from "lucide-react";

import { api } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction } from "../../lib/hooks";
import { escapeForDisplay } from "../../lib/format";
import { ApiOfflineNote, Metric, Metrics } from "../ui/Bits";

/** Track T1. Compare against a hosted model, and keep the key off the browser. */
export default function ExternalPanel() {
  const { apiBaseUrl, status, modelId } = useConsole();
  const [message, setMessage] = useState("Explain what a checkpoint is.");
  const [provider, setProvider] = useState("openai-compatible");
  const [sides, setSides] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const providers = useAction(() => api.externalModels(apiBaseUrl));
  const preview = useAction((body) => api.externalPromptPreview(apiBaseUrl, body));

  useEffect(() => {
    if (status === "online") providers.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, apiBaseUrl]);

  const list = providers.result ?? [];
  const selected = list.find((item) => item.provider === provider) ?? list[0] ?? null;
  const configured = selected?.state === "ready" || selected?.state === "configured";

  const body = {
    message,
    provider,
    model_id: selected?.model_id ?? "openai-compatible",
    max_new_tokens: 128,
    inference_mode: "focused"
  };

  async function compare() {
    setPending(true);
    setError(null);
    try {
      const [local, external] = await Promise.allSettled([
        api.chat(apiBaseUrl, { message, model_id: modelId, max_new_tokens: 128, inference_mode: "focused" }),
        api.externalChat(apiBaseUrl, body)
      ]);
      setSides({
        local: local.status === "fulfilled" ? local.value : { error: local.reason?.message },
        external: external.status === "fulfilled" ? external.value : { error: external.reason?.message }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p>
        This track teaches integration, not model building — nothing later depends on it. Take it
        once for a reference point on how far a lightly tuned GPT-2 is from a production
        assistant, and to see the one security boundary in this project.
      </p>

      <ApiOfflineNote status={status} />
      {providers.error ? <p className="lx-error">{providers.error}</p> : null}

      <table className="lx-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Model id</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item) => (
            <tr key={item.provider}>
              <td>
                <code>{item.provider}</code>
              </td>
              <td>{item.model_id}</td>
              <td>
                <span className={`lx-pill ${item.state === "ready" ? "online" : ""}`}>
                  {item.state}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!configured ? (
        <p className="lx-note">
          No provider is configured. Set the environment variables{" "}
          <strong>before starting the API</strong> — they are read by the API process, never sent
          to the browser:
          <br />
          <code>CHATOKEN_EXTERNAL_OPENAI_API_KEY</code>,{" "}
          <code>CHATOKEN_EXTERNAL_OPENAI_MODEL</code>,{" "}
          <code>CHATOKEN_EXTERNAL_OPENAI_BASE_URL</code> — or the{" "}
          <code>CHATOKEN_EXTERNAL_OLLAMA_*</code> equivalents.
        </p>
      ) : null}

      <div className="lx-controls" style={{ marginTop: "14px" }}>
        <div className="lx-field grow">
          <label htmlFor="lx-ex-message">Message sent to both sides</label>
          <input
            id="lx-ex-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
        <div className="lx-field narrow">
          <label htmlFor="lx-ex-provider">provider</label>
          <select
            id="lx-ex-provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            {list.map((item) => (
              <option key={item.provider} value={item.provider}>
                {item.provider}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="lx-controls" style={{ marginTop: "12px" }}>
        <button
          type="button"
          className="lx-secondary"
          disabled={preview.pending || status !== "online"}
          onClick={() => preview.run(body)}
        >
          Preview outgoing request
        </button>
        <button
          type="button"
          className="lx-primary"
          disabled={pending || !configured || status !== "online"}
          onClick={compare}
        >
          {pending ? <LoaderCircle size={15} /> : <GitCompareArrows size={15} />} Compare local vs
          provider
        </button>
      </div>

      {error ? <p className="lx-error">{error}</p> : null}
      {preview.error ? <p className="lx-error">{preview.error}</p> : null}

      {preview.result ? (
        <>
          <Metrics>
            <Metric label="Provider" value={preview.result.provider} />
            <Metric label="Provider model" value={preview.result.provider_model_name ?? "—"} />
            <Metric label="Prompt style" value={preview.result.prompt_style} />
          </Metrics>
          <span className="lx-block-label" style={{ marginTop: "12px" }}>
            Exactly what would leave your machine
          </span>
          <pre className="lx-code">{JSON.stringify(preview.result.messages ?? preview.result, null, 1)}</pre>
          {preview.result.unsupported_settings?.length ? (
            <p className="lx-note">{preview.result.unsupported_settings.join(" ")}</p>
          ) : null}
        </>
      ) : null}

      {sides ? (
        <div className="lx-compare">
          <div>
            <span className="lx-block-label">Local — {modelId}</span>
            <pre className="lx-code">
              {sides.local.error ?? escapeForDisplay(sides.local.reply) ?? "(none)"}
            </pre>
          </div>
          <div>
            <span className="lx-block-label">Provider — {provider}</span>
            <pre className="lx-code">
              {sides.external.error ?? escapeForDisplay(sides.external.reply) ?? "(none)"}
            </pre>
          </div>
        </div>
      ) : null}

      <p className="lx-note">
        No credential appears in any browser-visible response — the browser calls your API, which
        calls the provider server-side. Anything prefixed <code>NEXT_PUBLIC_</code> is compiled
        into the JavaScript bundle and is effectively public, so keys must never go there.
      </p>
    </>
  );
}
