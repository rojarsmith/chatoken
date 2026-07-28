"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Play } from "lucide-react";

import { api, JOB_ENDPOINTS } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction, useJob } from "../../lib/hooks";
import { formatNumber } from "../../lib/format";
import { ApiOfflineNote, JobStatus, Metric, Metrics } from "../ui/Bits";

const DEFAULTS = { max_steps: 80, batch_size: 4, block_size: 32, learning_rate: 0.003, eval_every: 10 };
const CONTEXT_LENGTH = 64; // random-tiny-byte

/**
 * Stage 05. The derived numbers update as you type — no request needed — and the
 * run log accumulates one row per experiment so single-knob changes are comparable.
 */
export default function KnobsPanel() {
  const { apiBaseUrl, status } = useConsole();
  const [knobs, setKnobs] = useState(DEFAULTS);
  const [runs, setRuns] = useState([]);

  const datasets = useAction(() => api.datasets(apiBaseUrl));
  const job = useJob(apiBaseUrl, JOB_ENDPOINTS.training);

  useEffect(() => {
    if (status === "online") datasets.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, apiBaseUrl]);

  const datasetTokens =
    datasets.result?.find((item) => item.dataset_id === "every-effort")?.byte_tokens ?? null;

  const derived = useMemo(() => {
    const tokensPerStep = knobs.batch_size * knobs.block_size;
    const windows = datasetTokens ? Math.max(0, datasetTokens - knobs.block_size) : null;
    return {
      tokensPerStep,
      totalTokens: tokensPerStep * knobs.max_steps,
      windows,
      passes: datasetTokens ? (tokensPerStep * knobs.max_steps) / datasetTokens : null
    };
  }, [knobs, datasetTokens]);

  const warnings = [];
  if (knobs.block_size > CONTEXT_LENGTH) {
    warnings.push(
      `block_size ${knobs.block_size} exceeds the model's context_length of ${CONTEXT_LENGTH}. Training will fail.`
    );
  }
  if (derived.windows !== null && derived.windows < knobs.batch_size) {
    warnings.push(
      `Only ${derived.windows} training windows fit — fewer than batch_size ${knobs.batch_size}.`
    );
  }
  if (knobs.learning_rate > 0.02) warnings.push("Learning rate is high; expect oscillation or nan.");
  if (knobs.learning_rate < 0.0001) warnings.push("Learning rate is very low; loss will barely move.");

  const changed = Object.keys(DEFAULTS).filter((key) => knobs[key] !== DEFAULTS[key]);

  async function run() {
    const created = await job.start({
      dataset_id: "every-effort",
      base_model_id: "random-tiny-byte",
      output_model_id: "trained-tiny-byte",
      ...knobs,
      load_when_complete: false
    });
    if (!created) return;

    // Poll separately for the row so the log records the finished result.
    const poll = async () => {
      const next = await api.trainingJob(apiBaseUrl, created.job_id);
      if (next.status === "succeeded") {
        setRuns((current) =>
          [
            {
              label: changed.length ? changed.map((key) => `${key}=${knobs[key]}`).join(", ") : "defaults",
              finalLoss: next.result?.training_summary?.final_loss ?? null,
              tokensSeen: next.result?.training_summary?.tokens_seen ?? null,
              knobs: { ...knobs }
            },
            ...current
          ].slice(0, 8)
        );
      } else if (next.status === "running" || next.status === "queued") {
        setTimeout(poll, 700);
      } else {
        setRuns((current) =>
          [{ label: "failed", finalLoss: null, tokensSeen: null, error: next.error }, ...current].slice(0, 8)
        );
      }
    };
    setTimeout(poll, 700);
  }

  return (
    <>
      <p>
        Change <strong>one knob at a time</strong> and watch both the derived numbers and the
        final loss. Everything above the run log updates without touching the API.
      </p>

      <ApiOfflineNote status={status} />

      <div className="lx-controls">
        {[
          ["max_steps", 1, 2000, 1],
          ["batch_size", 1, 64, 1],
          ["block_size", 2, 1024, 1],
          ["eval_every", 1, 500, 1]
        ].map(([name, min, max, step]) => (
          <div key={name} className="lx-field narrow">
            <label htmlFor={`lx-knob-${name}`}>{name}</label>
            <input
              id={`lx-knob-${name}`}
              type="number"
              min={min}
              max={max}
              step={step}
              value={knobs[name]}
              onChange={(event) =>
                setKnobs({ ...knobs, [name]: Number(event.target.value) })
              }
            />
          </div>
        ))}
        <div className="lx-field narrow">
          <label htmlFor="lx-knob-lr">learning_rate</label>
          <input
            id="lx-knob-lr"
            type="number"
            min={0.00001}
            max={1}
            step={0.0001}
            value={knobs.learning_rate}
            onChange={(event) =>
              setKnobs({ ...knobs, learning_rate: Number(event.target.value) })
            }
          />
        </div>
      </div>

      <Metrics>
        <Metric
          label="Tokens per step"
          value={derived.tokensPerStep}
          hint={`${knobs.batch_size} × ${knobs.block_size}`}
        />
        <Metric label="Total tokens" value={derived.totalTokens} />
        <Metric
          label="Training windows"
          value={derived.windows ?? "—"}
          hint={datasetTokens ? `${formatNumber(datasetTokens)} dataset tokens` : "needs the API"}
        />
        <Metric
          label="Passes over data"
          value={derived.passes ? `${derived.passes.toFixed(1)}×` : "—"}
        />
      </Metrics>

      {warnings.map((warning) => (
        <p key={warning} className="lx-note">
          {warning}
        </p>
      ))}

      <div className="lx-controls" style={{ marginTop: "14px" }}>
        <button
          type="button"
          className="lx-primary"
          disabled={job.running || job.starting || status !== "online"}
          onClick={run}
        >
          {job.running || job.starting ? <LoaderCircle size={15} /> : <Play size={15} />} Run with
          these knobs
        </button>
        <button type="button" className="lx-secondary" onClick={() => setKnobs(DEFAULTS)}>
          Reset to defaults
        </button>
      </div>

      <JobStatus job={job.job} error={job.error} onCancel={job.cancel} />

      {runs.length ? (
        <table className="lx-table lx-runlog">
          <thead>
            <tr>
              <th>Run</th>
              <th className="num">Final loss</th>
              <th className="num">Tokens seen</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, index) => (
              <tr key={`${run.label}-${index}`}>
                <td>{run.error ? `failed: ${run.error}` : run.label}</td>
                <td className="num">{run.finalLoss?.toFixed(4) ?? "—"}</td>
                <td className="num">{run.tokensSeen ? formatNumber(run.tokensSeen) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <p className="lx-deepdive" style={{ marginTop: "12px" }}>
        <code>eval_every</code> changes only how often loss is logged. Run it twice with
        different values and confirm the final loss is identical — that is what &quot;logging&quot;
        means.
      </p>
    </>
  );
}
