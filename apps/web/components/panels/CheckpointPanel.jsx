"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";

import { api } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction } from "../../lib/hooks";
import { formatNumber } from "../../lib/format";
import { ApiOfflineNote, Metric, Metrics } from "../ui/Bits";

function formatBytes(value) {
  if (typeof value !== "number") return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

/** Stage 07. What is inside a checkpoint file, and loading one back. */
export default function CheckpointPanel() {
  const { apiBaseUrl, status, refresh, setModelId } = useConsole();
  const [selectedId, setSelectedId] = useState(null);

  const checkpoints = useAction(() => api.checkpoints(apiBaseUrl));
  const load = useAction((body) => api.loadModel(apiBaseUrl, body));

  useEffect(() => {
    if (status === "online") checkpoints.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, apiBaseUrl]);

  const list = checkpoints.result ?? [];
  const selected = list.find((item) => item.checkpoint_id === selectedId) ?? list[0] ?? null;

  return (
    <>
      <p>
        Every training run writes one <code>.pt</code> file. Pick one to see what it recorded,
        then load it back as a chat model.
      </p>

      <ApiOfflineNote status={status} />
      {checkpoints.error ? <p className="lx-error">{checkpoints.error}</p> : null}

      {list.length === 0 && status === "online" ? (
        <p className="lx-note">
          No checkpoints yet — <code>models/checkpoints/</code> is git-ignored, so a fresh clone
          starts empty. Run Stage 04 first.
        </p>
      ) : null}

      {list.length ? (
        <div className="lx-controls">
          <div className="lx-field grow">
            <label htmlFor="lx-cp-select">Checkpoint ({list.length} saved)</label>
            <select
              id="lx-cp-select"
              value={selected?.checkpoint_id ?? ""}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {list.map((item) => (
                <option key={item.checkpoint_id} value={item.checkpoint_id}>
                  {item.model_id} — {item.created_at?.slice(0, 19).replace("T", " ")}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="lx-secondary" onClick={() => checkpoints.run()}>
            Refresh
          </button>
        </div>
      ) : null}

      {selected ? (
        <>
          <Metrics>
            <Metric label="Model id" value={selected.model_id} />
            <Metric label="Base model" value={selected.base_model_id} hint="lineage" />
            <Metric label="Tokenizer" value={selected.tokenizer} />
            <Metric label="File size" value={formatBytes(selected.size_bytes)} />
          </Metrics>

          <table className="lx-table" style={{ marginTop: "14px" }}>
            <thead>
              <tr>
                <th>Recorded field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>version_id</code>
                </td>
                <td>{selected.version_id}</td>
              </tr>
              <tr>
                <td>
                  <code>run_config.dataset_id</code>
                </td>
                <td>{selected.run_config?.dataset_id ?? "—"}</td>
              </tr>
              <tr>
                <td>
                  <code>run_config.max_steps</code>
                </td>
                <td>{selected.run_config?.max_steps ?? "—"}</td>
              </tr>
              <tr>
                <td>
                  <code>run_config.learning_rate</code>
                </td>
                <td>{selected.run_config?.learning_rate ?? "—"}</td>
              </tr>
              <tr>
                <td>
                  <code>metrics.final_loss</code>
                </td>
                <td>{selected.metrics?.final_loss ?? "—"}</td>
              </tr>
              <tr>
                <td>
                  <code>metrics.tokens_seen</code>
                </td>
                <td>
                  {selected.metrics?.tokens_seen
                    ? formatNumber(selected.metrics.tokens_seen)
                    : "—"}
                </td>
              </tr>
              <tr>
                <td>
                  <code>path</code>
                </td>
                <td style={{ wordBreak: "break-all" }}>{selected.path}</td>
              </tr>
            </tbody>
          </table>

          <button
            type="button"
            className="lx-primary"
            style={{ marginTop: "14px" }}
            disabled={load.pending}
            onClick={async () => {
              const loaded = await load.run({
                checkpoint_id: selected.checkpoint_id,
                model_id: selected.model_id
              });
              if (loaded) {
                setModelId(selected.model_id);
                refresh();
              }
            }}
          >
            {load.pending ? <LoaderCircle size={15} /> : <Save size={15} />} Load as chat model
          </button>

          {load.error ? <p className="lx-error">{load.error}</p> : null}
          {load.result ? (
            <p className="lx-note">
              Loaded as <code>{selected.model_id}</code> and selected in the Playground — send it
              a prompt on the right.
            </p>
          ) : null}

          <p className="lx-deepdive" style={{ marginTop: "12px" }}>
            The file also holds the full <code>state_dict</code> and the <code>model_config</code>{" "}
            needed to rebuild the architecture. It does <strong>not</strong> hold the model source
            code.
          </p>
        </>
      ) : null}
    </>
  );
}
