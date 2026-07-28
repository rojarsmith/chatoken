"use client";

import { REFERENCE, TRACKS } from "../../content/curriculum";
import { formatNumber } from "../../lib/format";

/**
 * Inspection tools used across many stages. They live in a drawer rather than
 * as ladder entries so they never compete with the course for attention.
 */
export default function WorkbenchDrawer({ models, runtime }) {
  return (
    <details className="lx-workbench">
      <summary>Workbench — models, runtime, tracks, reference</summary>
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
