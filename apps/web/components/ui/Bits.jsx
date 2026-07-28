"use client";

import { escapeForDisplay, formatNumber } from "../../lib/format";

export function Metric({ label, value, hint }) {
  const text = typeof value === "number" ? formatNumber(value) : String(value ?? "—");
  return (
    <div className="lx-metric">
      <span>{label}</span>
      <b style={{ fontSize: text.length > 12 ? "14px" : "19px" }}>{text}</b>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function Metrics({ children }) {
  return <div className="lx-metrics">{children}</div>;
}

const STATUS_HINT = {
  queued: "waiting for the single worker",
  running: "in progress",
  succeeded: "done",
  failed: "see the error below",
  cancelled: "stopped at a safe checkpoint"
};

export function JobStatus({ job, error, onCancel }) {
  if (error) return <p className="lx-error">{error}</p>;
  if (!job) return null;

  const active = job.status === "queued" || job.status === "running";

  return (
    <div style={{ marginTop: "14px" }}>
      <div className="lx-metrics">
        <Metric label="Status" value={job.status} hint={STATUS_HINT[job.status]} />
        {job.progress?.length ? (
          <Metric label="Events" value={job.progress.length} />
        ) : null}
        {job.cancel_requested ? <Metric label="cancel_requested" value="true" /> : null}
      </div>
      {active && onCancel ? (
        <button type="button" className="lx-secondary" style={{ marginTop: "10px" }} onClick={onCancel}>
          Cancel job
        </button>
      ) : null}
      {job.error ? <p className="lx-error">{job.error}</p> : null}
    </div>
  );
}

/** Renders the loss events a training job streams into job.progress. */
export function LossTable({ progress }) {
  if (!progress?.length) return null;
  const first = progress[0];
  const last = progress[progress.length - 1];

  // Step 1 is the anchor for this stage — it should sit near ln(vocab_size) —
  // so it is always shown, even when the tail is truncated.
  const tail = progress.slice(-7);
  const rows = tail.includes(first) ? tail : [first, null, ...tail];

  return (
    <>
      <table className="lx-table" style={{ marginTop: "12px" }}>
        <thead>
          <tr>
            <th>Step</th>
            <th>Loss</th>
            <th>Tokens seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((event, index) =>
            event === null ? (
              <tr key="gap">
                <td colSpan={3} className="lx-deepdive">
                  …
                </td>
              </tr>
            ) : (
              <tr key={`${index}-${event.step}`}>
                <td>
                  {event.step} / {event.max_steps}
                </td>
                <td>{event.loss?.toFixed(4)}</td>
                <td>{formatNumber(event.tokens_seen)}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
      {progress.length > 1 ? (
        <p className="lx-deepdive" style={{ marginTop: "8px" }}>
          First logged step {first.step}: loss {first.loss?.toFixed(4)} · last step {last.step}:
          loss {last.loss?.toFixed(4)}
        </p>
      ) : null}
    </>
  );
}

export function SampleCompare({ before, after, beforeLabel = "Before", afterLabel = "After" }) {
  if (!before && !after) return null;
  return (
    <div className="lx-compare">
      <div>
        <span className="lx-block-label">{beforeLabel}</span>
        <pre className="lx-code">{escapeForDisplay(before) || "(none)"}</pre>
      </div>
      <div>
        <span className="lx-block-label">{afterLabel}</span>
        <pre className="lx-code">{escapeForDisplay(after) || "(none)"}</pre>
      </div>
    </div>
  );
}

export function ApiOfflineNote({ status }) {
  if (status !== "offline") return null;
  return (
    <p className="lx-note">
      The API is not reachable. Start it with{" "}
      <code>python -m uvicorn apps.api.main:app --reload --port 8000</code>, or correct the URL
      in the top bar.
    </p>
  );
}
