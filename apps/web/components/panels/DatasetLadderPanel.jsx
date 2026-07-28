"use client";

import { useEffect, useState } from "react";
import { Download, LoaderCircle, Play } from "lucide-react";

import { api, JOB_ENDPOINTS } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction, useJob } from "../../lib/hooks";
import { escapeForDisplay, formatNumber } from "../../lib/format";
import { ApiOfflineNote, JobStatus, LossTable, Metric, Metrics } from "../ui/Bits";

const LADDER = ["every-effort", "every-effort-expanded", "learning-dialogues", "the-verdict"];

/** Stage 06. The four rungs, in order, with the loss each one reaches. */
export default function DatasetLadderPanel() {
  const { apiBaseUrl, status, refresh } = useConsole();
  const [selected, setSelected] = useState(LADDER[1]);
  const [results, setResults] = useState({});

  const datasets = useAction(() => api.datasets(apiBaseUrl));
  const prepare = useAction((id) => api.prepareDataset(apiBaseUrl, id));
  const job = useJob(apiBaseUrl, JOB_ENDPOINTS.training);

  useEffect(() => {
    if (status === "online") datasets.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, apiBaseUrl]);

  const byId = Object.fromEntries((datasets.result ?? []).map((item) => [item.dataset_id, item]));
  const spec = byId[selected];
  const summary = job.job?.result?.training_summary ?? null;

  async function run() {
    if (!spec) return;
    const created = await job.start({
      dataset_id: spec.dataset_id,
      base_model_id: spec.recommended_base_model_id,
      output_model_id: spec.output_model_id,
      max_steps: spec.recommended_steps,
      batch_size: spec.recommended_batch_size,
      block_size: spec.recommended_block_size,
      learning_rate: spec.recommended_learning_rate,
      eval_every: Math.max(1, Math.round(spec.recommended_steps / 8)),
      sample_prompt: spec.comparison_prompt,
      load_when_complete: true
    });
    if (!created) return;

    const poll = async () => {
      const next = await api.trainingJob(apiBaseUrl, created.job_id);
      if (next.status === "succeeded") {
        setResults((current) => ({
          ...current,
          [spec.dataset_id]: {
            finalLoss: next.result?.training_summary?.final_loss ?? null,
            tokens: next.result?.training_summary?.dataset_tokens ?? null
          }
        }));
        refresh();
      } else if (next.status === "running" || next.status === "queued") {
        setTimeout(poll, 700);
      }
    };
    setTimeout(poll, 700);
  }

  return (
    <>
      <p>
        Climb the ladder in order. Each rung uses its own recommended settings, so the only thing
        changing is the data.
      </p>

      <ApiOfflineNote status={status} />
      {datasets.error ? <p className="lx-error">{datasets.error}</p> : null}

      {LADDER.map((id, index) => {
        const item = byId[id];
        const result = results[id];
        return (
          <div key={id} className={`lx-rung${selected === id ? " selected" : ""}`}>
            <b>
              {index + 1}. {item?.label ?? id}
            </b>
            <small>
              {item ? `${item.tier} · ${formatNumber(item.byte_tokens)} tokens` : "loading…"}
              {item?.prompt_style === "raw" ? " · raw text" : ""}
            </small>
            <span className="lx-rung-spacer" />
            {result ? (
              <small>
                final loss <strong>{result.finalLoss?.toFixed(4)}</strong>
              </small>
            ) : null}
            {item && !item.exists ? (
              <button
                type="button"
                className="lx-secondary"
                disabled={prepare.pending}
                onClick={async () => {
                  await prepare.run(id);
                  datasets.run();
                }}
              >
                <Download size={13} /> Prepare
              </button>
            ) : null}
            <button
              type="button"
              className="lx-secondary"
              onClick={() => setSelected(id)}
              disabled={selected === id}
            >
              {selected === id ? "Selected" : "Select"}
            </button>
          </div>
        );
      })}

      {prepare.error ? <p className="lx-error">{prepare.error}</p> : null}

      {spec ? (
        <>
          <Metrics>
            <Metric label="Dataset" value={spec.dataset_id} />
            <Metric label="Recommended steps" value={spec.recommended_steps} />
            <Metric label="block_size" value={spec.recommended_block_size} />
            <Metric label="Prompt style" value={spec.prompt_style ?? "chat"} />
            <Metric label="Objective" value={spec.training_objective ?? "text"} />
          </Metrics>
          {spec.learning_goal ? <p className="lx-deepdive">{spec.learning_goal}</p> : null}
        </>
      ) : null}

      <button
        type="button"
        className="lx-primary"
        style={{ marginTop: "14px" }}
        disabled={job.running || job.starting || !spec?.exists || status !== "online"}
        onClick={run}
      >
        {job.running || job.starting ? <LoaderCircle size={15} /> : <Play size={15} />} Train this
        rung
      </button>
      {spec && !spec.exists ? (
        <p className="lx-note">
          This dataset has not been downloaded yet. Press <strong>Prepare</strong> first.
        </p>
      ) : null}

      <JobStatus job={job.job} error={job.error} onCancel={job.cancel} />
      <LossTable progress={job.job?.progress} />

      {summary ? (
        <>
          <Metrics>
            <Metric label="Final loss" value={summary.final_loss?.toFixed(4)} />
            <Metric label="Dataset tokens" value={summary.dataset_tokens} />
            <Metric label="Tokens seen" value={summary.tokens_seen} />
          </Metrics>
          <span className="lx-block-label" style={{ marginTop: "12px" }}>
            Sample after training
          </span>
          <pre className="lx-code">{escapeForDisplay(summary.sample_text) || "(none)"}</pre>
        </>
      ) : null}

      {Object.keys(results).length > 1 ? (
        <p className="lx-note">
          Compare the final losses above. They go <strong>up</strong> as you climb — harder data,
          more actually learned. The lowest number belongs to the least useful model.
        </p>
      ) : null}
    </>
  );
}
