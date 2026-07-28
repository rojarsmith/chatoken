"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Play, XCircle } from "lucide-react";

import { api, streamChat } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { escapeForDisplay } from "../../lib/format";
import { ApiOfflineNote, Metric, Metrics } from "../ui/Bits";

/** Stage 16. The generation loop, reported as it runs — plus cooperative cancellation. */
export default function StreamingPanel() {
  const { apiBaseUrl, status, modelId } = useConsole();
  const [events, setEvents] = useState([]);
  const [reply, setReply] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [firstTokenMs, setFirstTokenMs] = useState(null);
  const [totalMs, setTotalMs] = useState(null);
  const abortRef = useRef(null);

  // Cancellation demo, using a long training job as the cancellable work.
  const [cancelJob, setCancelJob] = useState(null);
  const [cancelLog, setCancelLog] = useState([]);

  async function runStream() {
    setStreaming(true);
    setError(null);
    setEvents([]);
    setReply("");
    setFirstTokenMs(null);
    setTotalMs(null);
    const started = performance.now();
    let first = null;
    abortRef.current = new AbortController();

    try {
      await streamChat(
        apiBaseUrl,
        { model_id: modelId, message: "Every effort moves you", max_new_tokens: 24, temperature: 0 },
        {
          signal: abortRef.current.signal,
          onEvent: (event) => {
            if (event.event === "token" && first === null) {
              first = performance.now() - started;
              setFirstTokenMs(Math.round(first));
            }
            if (event.event === "token") setReply(event.reply ?? "");
            setEvents((current) => [...current, event]);
          }
        }
      );
      setTotalMs(Math.round(performance.now() - started));
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setStreaming(false);
    }
  }

  async function startCancellable() {
    setCancelLog([]);
    const created = await api.createTrainingJob(apiBaseUrl, {
      dataset_id: "the-verdict",
      base_model_id: "random-tiny-byte",
      output_model_id: "cancel-demo",
      max_steps: 2000,
      block_size: 64,
      eval_every: 50,
      load_when_complete: false
    });
    setCancelJob(created);
    setCancelLog([`created — status ${created.status}`]);
  }

  async function cancelNow() {
    if (!cancelJob) return;
    const t0 = performance.now();
    const cancelled = await api.cancelTrainingJob(apiBaseUrl, cancelJob.job_id);
    setCancelLog((c) => [
      ...c,
      `cancel requested — status ${cancelled.status}, cancel_requested ${cancelled.cancel_requested}`
    ]);
    const poll = async () => {
      const next = await api.trainingJob(apiBaseUrl, cancelJob.job_id);
      if (next.status === "cancelled" || next.status === "succeeded" || next.status === "failed") {
        setCancelLog((c) => [
          ...c,
          `reached ${next.status} after ${Math.round(performance.now() - t0)} ms`
        ]);
        setCancelJob(next);
      } else {
        setTimeout(poll, 200);
      }
    };
    poll();
  }

  const tokenEvents = events.filter((e) => e.event === "token");

  return (
    <>
      <p>
        Every endpoint so far hid the loop: the request blocked until generation finished, then
        returned everything. Streaming exposes the loop that was always there.
      </p>

      <ApiOfflineNote status={status} />

      <div className="lx-controls">
        <button
          type="button"
          className="lx-primary"
          disabled={streaming || status !== "online"}
          onClick={runStream}
        >
          {streaming ? <LoaderCircle size={15} /> : <Play size={15} />} Stream a reply
        </button>
        {streaming ? (
          <button type="button" className="lx-secondary" onClick={() => abortRef.current?.abort()}>
            <XCircle size={13} /> Stop reading
          </button>
        ) : null}
      </div>

      {error ? <p className="lx-error">{error}</p> : null}

      {events.length ? (
        <>
          <Metrics>
            <Metric label="Events" value={events.length} />
            <Metric label="Tokens" value={tokenEvents.length} />
            <Metric
              label="First token"
              value={firstTokenMs !== null ? `${firstTokenMs} ms` : "—"}
              hint="perceived latency"
            />
            <Metric
              label="Total"
              value={totalMs !== null ? `${totalMs} ms` : "—"}
              hint="unchanged by streaming"
            />
          </Metrics>

          <pre className="lx-code" style={{ marginTop: "12px" }}>
            {escapeForDisplay(reply) || "(empty)"}
          </pre>

          <details className="lx-advanced">
            <summary>Raw newline-delimited JSON events</summary>
            <pre className="lx-code" style={{ marginTop: "10px" }}>
              {events
                .slice(0, 6)
                .map((e) => JSON.stringify(e))
                .join("\n")}
              {events.length > 6 ? `\n… ${events.length - 6} more` : ""}
            </pre>
          </details>
        </>
      ) : null}

      <div style={{ marginTop: "18px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
        <span className="lx-block-label">Cooperative cancellation</span>
        <p>
          Cancellation is not forced. The API sets <code>cancel_requested</code>; the worker
          stops at its next safe checkpoint. A <code>queued</code> job flips immediately, a{" "}
          <code>running</code> one takes until the current step ends.
        </p>
        <div className="lx-controls">
          <button
            type="button"
            className="lx-secondary"
            disabled={status !== "online"}
            onClick={startCancellable}
          >
            Start a long job (2000 steps)
          </button>
          <button
            type="button"
            className="lx-secondary"
            disabled={!cancelJob || cancelJob.status === "cancelled"}
            onClick={cancelNow}
          >
            <XCircle size={13} /> Cancel it
          </button>
        </div>
        {cancelLog.length ? (
          <pre className="lx-code" style={{ marginTop: "10px" }}>
            {cancelLog.join("\n")}
          </pre>
        ) : null}
      </div>

      <p className="lx-note">
        Streaming changes how tokens are delivered, not how many or which ones. At{" "}
        <code>temperature 0</code> the streamed and blocking calls return identical text — and the
        total time is the same. Only the wait for the first token changes.
      </p>
    </>
  );
}
