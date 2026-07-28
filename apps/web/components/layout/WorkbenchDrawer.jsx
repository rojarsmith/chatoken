"use client";

import { useEffect, useState } from "react";

import { REFERENCE, TRACKS } from "../../content/curriculum";
import { api } from "../../lib/api";
import { formatNumber } from "../../lib/format";

/**
 * Inspection tools used across many stages. They live in a drawer rather than
 * as ladder entries so they never compete with the course for attention.
 */
export default function WorkbenchDrawer({ models, runtime, apiBaseUrl }) {
  const [open, setOpen] = useState(false);
  const [checkpoints, setCheckpoints] = useState(null);

  // Only fetch once the drawer is actually opened.
  useEffect(() => {
    if (!open || checkpoints !== null) return;
    api
      .checkpoints(apiBaseUrl)
      .then(setCheckpoints)
      .catch(() => setCheckpoints([]));
  }, [open, checkpoints, apiBaseUrl]);

  return (
    <details className="lx-workbench" onToggle={(event) => setOpen(event.target.open)}>
      <summary>Workbench — models, checkpoints, runtime, tracks, reference</summary>
      <div className="lx-workbench-body">
        <section>
          <h3>Loaded models</h3>
          {models.length === 0 ? (
            <p className="lx-deepdive">No models reported. Is the API running?</p>
          ) : (
            <table className="lx-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Params</th>
                  <th>Ctx</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.model_id}>
                    <td>
                      <code>{model.model_id}</code>
                      <br />
                      <span className="lx-deepdive">{model.state}</span>
                    </td>
                    <td>{formatNumber(model.parameters)}</td>
                    <td>{formatNumber(model.context_length)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h3>Checkpoints</h3>
          {checkpoints === null ? (
            <p className="lx-deepdive">Loading…</p>
          ) : checkpoints.length === 0 ? (
            <p className="lx-deepdive">
              None saved. <code>models/checkpoints/</code> is git-ignored; Stage 04 creates the
              first one.
            </p>
          ) : (
            <table className="lx-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>From</th>
                  <th>Loss</th>
                </tr>
              </thead>
              <tbody>
                {checkpoints.slice(0, 8).map((item) => (
                  <tr key={item.checkpoint_id}>
                    <td>
                      <code>{item.model_id}</code>
                      <br />
                      <span className="lx-deepdive">
                        {item.created_at?.slice(0, 19).replace("T", " ")}
                      </span>
                    </td>
                    <td>{item.base_model_id}</td>
                    <td>{item.metrics?.final_loss ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h3>Runtime</h3>
          {runtime ? (
            <table className="lx-table">
              <tbody>
                <tr>
                  <td>device</td>
                  <td>
                    <code>{runtime.device}</code>
                  </td>
                </tr>
                <tr>
                  <td>torch</td>
                  <td>
                    <code>{runtime.torch_version}</code>
                  </td>
                </tr>
                <tr>
                  <td>cuda</td>
                  <td>
                    <code>{runtime.cuda_version ?? "none"}</code>
                  </td>
                </tr>
                <tr>
                  <td>gpu</td>
                  <td>{runtime.device_name ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="lx-deepdive">Runtime unavailable.</p>
          )}
        </section>

        <section>
          <h3>Optional track</h3>
          {TRACKS.map((track) => (
            <p key={track.id} className="lx-deepdive">
              <strong>{track.title}</strong> — {track.focus}
              <br />
              <code>{track.doc}</code>
            </p>
          ))}
        </section>

        <section>
          <h3>Reference</h3>
          <p className="lx-deepdive">
            {REFERENCE.map((item) => (
              <span key={item.id}>
                <code>{item.doc}</code>
                <br />
              </span>
            ))}
          </p>
        </section>
      </div>
    </details>
  );
}
