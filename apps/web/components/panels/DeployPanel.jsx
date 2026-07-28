"use client";

import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";

import { api } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction } from "../../lib/hooks";
import { ApiOfflineNote, Metric, Metrics } from "../ui/Bits";

function mb(bytes) {
  if (typeof bytes !== "number") return "—";
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

const POOLS = [
  ["parameter_bytes", "Weights — paid once per loaded model"],
  ["kv_cache_like_bytes", "What production servers cache per request"],
  ["local_context_work_bytes", "Working memory for this teaching loop"],
  ["attention_scratch_bytes", "Grows with context SQUARED"]
];

/** Stage 17. One dimension at a time, so the quadratic term is visible. */
export default function DeployPanel() {
  const { apiBaseUrl, status, modelId } = useConsole();
  const [request, setRequest] = useState({
    prompt_tokens: 32,
    max_new_tokens: 64,
    concurrent_requests: 1,
    precision: "fp32",
    include_training: false,
    batch_size: 4,
    block_size: 32
  });

  const profile = useAction(() => api.deploymentProfile(apiBaseUrl));
  const estimate = useAction((body) => api.deploymentEstimate(apiBaseUrl, body));

  useEffect(() => {
    if (status === "online") {
      profile.run();
      estimate.run({ model_id: modelId, ...request });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, apiBaseUrl, modelId]);

  const result = estimate.result;
  const limits = profile.result?.limits;

  const update = (patch) => {
    const next = { ...request, ...patch };
    setRequest(next);
    estimate.run({ model_id: modelId, ...next });
  };

  return (
    <>
      <p>
        Weights are paid once. Everything else is paid <strong>per concurrent request</strong> —
        which is why a model that runs comfortably alone can fail with ten users on the same box.
      </p>

      <ApiOfflineNote status={status} />

      <div className="lx-controls">
        {[
          ["prompt_tokens", 0, 8192],
          ["max_new_tokens", 1, 2000],
          ["concurrent_requests", 1, 256]
        ].map(([name, min, max]) => (
          <div key={name} className="lx-field narrow">
            <label htmlFor={`lx-dp-${name}`}>{name}</label>
            <input
              id={`lx-dp-${name}`}
              type="number"
              min={min}
              max={max}
              value={request[name]}
              onChange={(event) => update({ [name]: Number(event.target.value) })}
            />
          </div>
        ))}
        <div className="lx-field narrow">
          <label htmlFor="lx-dp-precision">precision</label>
          <select
            id="lx-dp-precision"
            value={request.precision}
            onChange={(event) => update({ precision: event.target.value })}
          >
            <option value="fp32">fp32</option>
            <option value="fp16">fp16</option>
          </select>
        </div>
        <div className="lx-field narrow">
          <label htmlFor="lx-dp-training">include_training</label>
          <select
            id="lx-dp-training"
            value={String(request.include_training)}
            onChange={(event) => update({ include_training: event.target.value === "true" })}
          >
            <option value="false">no</option>
            <option value="true">yes</option>
          </select>
        </div>
      </div>

      {estimate.error ? <p className="lx-error">{estimate.error}</p> : null}

      {result ? (
        <>
          <Metrics>
            <Metric label="Model" value={result.model?.model_id ?? modelId} />
            <Metric
              label="Inference total"
              value={mb(result.inference?.total_estimated_bytes)}
            />
            {result.training?.enabled ? (
              <Metric label="Training total" value={mb(result.training.total_estimated_bytes)} />
            ) : null}
            <Metric
              label="Effective context"
              value={result.request?.effective_context_tokens}
            />
          </Metrics>

          <table className="lx-table" style={{ marginTop: "14px" }}>
            <thead>
              <tr>
                <th>Memory pool</th>
                <th className="num">Size</th>
                <th>Grows with</th>
              </tr>
            </thead>
            <tbody>
              {POOLS.map(([key, note]) => (
                <tr key={key}>
                  <td>
                    <code>{key}</code>
                  </td>
                  <td className="num">{mb(result.inference?.[key])}</td>
                  <td>{note}</td>
                </tr>
              ))}
              {result.training?.enabled ? (
                <>
                  <tr>
                    <td>
                      <code>adamw_training_state_bytes</code>
                    </td>
                    <td className="num">{mb(result.training.adamw_training_state_bytes)}</td>
                    <td>Two optimizer states per trainable parameter</td>
                  </tr>
                  <tr>
                    <td>
                      <code>activation_estimate_bytes</code>
                    </td>
                    <td className="num">{mb(result.training.activation_estimate_bytes)}</td>
                    <td>Rough training activation memory</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>

          {result.warnings?.length ? (
            <p className="lx-note">{result.warnings.join(" ")}</p>
          ) : null}

          <p className="lx-deepdive" style={{ marginTop: "10px" }}>
            Double <code>prompt_tokens</code> and <code>max_new_tokens</code> and watch{" "}
            <code>attention_scratch_bytes</code> roughly quadruple. &ldquo;Just increase the
            context length&rdquo; is never free.
          </p>
        </>
      ) : null}

      {limits ? (
        <details className="lx-advanced">
          <summary>Server guardrails</summary>
          <table className="lx-table" style={{ marginTop: "12px" }}>
            <tbody>
              {Object.entries(limits).map(([key, value]) => (
                <tr key={key}>
                  <td>
                    <code>{key}</code>
                  </td>
                  <td>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lx-deepdive" style={{ marginTop: "10px" }}>
            The API also runs one training/pretrained worker at a time — deliberately, so behavior
            stays observable while learning.
          </p>
        </details>
      ) : null}

      <p className="lx-note">
        This project&apos;s generation loop recomputes the visible context every token rather than
        caching keys and values. <code>kv_cache_like_bytes</code> is still reported because
        caching is what real inference servers do, and knowing the shape of that cost matters more
        than matching this teaching loop.
      </p>
    </>
  );
}
