"use client";

import { useState } from "react";
import { LoaderCircle, Play } from "lucide-react";

import { JOB_ENDPOINTS } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useJob } from "../../lib/hooks";
import { formatNumber } from "../../lib/format";
import { ApiOfflineNote, JobStatus, LossTable, Metric, Metrics, SampleCompare } from "../ui/Bits";

const UNIFORM_LOSS = Math.log(257); // 5.549 — a uniform guess over the byte vocabulary.

/** Stage 04. One dataset, one button, and the loss curve it produces. */
export default function TrainingPanel() {
  const { apiBaseUrl, status, refresh } = useConsole();
  const [maxSteps, setMaxSteps] = useState(80);
  const [evalEvery, setEvalEvery] = useState(10);
  const [samplePrompt, setSamplePrompt] = useState("Every effort moves you");

  const job = useJob(apiBaseUrl, JOB_ENDPOINTS.training);
  const summary = job.job?.result?.training_summary ?? null;
  const checkpoint = job.job?.result?.checkpoint ?? null;

  async function run() {
    await job.start({
      dataset_id: "every-effort",
      base_model_id: "random-tiny-byte",
      output_model_id: "trained-tiny-byte",
      max_steps: Number(maxSteps),
      eval_every: Number(evalEvery),
      sample_prompt: samplePrompt,
      load_when_complete: true
    });
    refresh();
  }

  return (
    <>
      <p>
        Train <code>random-tiny-byte</code> on <code>every-effort</code> — four repetitions of
        the same two lines. The job generates a sample before training, runs the loop, generates
        a sample after, and saves a checkpoint.
      </p>

      <ApiOfflineNote status={status} />

      <button
        type="button"
        className="lx-primary"
        disabled={job.running || job.starting || status !== "online"}
        onClick={run}
      >
        {job.running || job.starting ? <LoaderCircle size={15} /> : <Play size={15} />} Run
        training
      </button>

      <JobStatus job={job.job} error={job.error} onCancel={job.cancel} />

      <LossTable progress={job.job?.progress} />

      {summary ? (
        <>
          <Metrics>
            <Metric label="Final loss" value={summary.final_loss?.toFixed(4)} />
            <Metric
              label="Uniform baseline"
              value={UNIFORM_LOSS.toFixed(4)}
              hint="ln(257) — random guessing"
            />
            <Metric label="Tokens seen" value={summary.tokens_seen} />
            <Metric
              label="Tokens per step"
              value={summary.batch_size * summary.block_size}
              hint={`${summary.batch_size} × ${summary.block_size}`}
            />
            <Metric label="Dataset tokens" value={summary.dataset_tokens} />
          </Metrics>

          <SampleCompare
            before={summary.before_sample}
            after={summary.sample_text}
            beforeLabel="Before training"
            afterLabel="After training"
          />

          {checkpoint ? (
            <p className="lx-deepdive" style={{ marginTop: "12px" }}>
              Checkpoint saved: <code>{checkpoint.checkpoint_id}</code> — Stage 07 opens it.
            </p>
          ) : null}

          {summary.dataset_tokens ? (
            <p className="lx-note">
              The model read {formatNumber(summary.tokens_seen)} tokens from a{" "}
              {formatNumber(summary.dataset_tokens)}-token file — about{" "}
              {Math.round(summary.tokens_seen / summary.dataset_tokens)}× over. It overfits this
              file rather than learning language. Note that overfitting does not mean it can
              reproduce the text cleanly: at this size it manages fragments, not sentences.
            </p>
          ) : null}
        </>
      ) : null}

      <details className="lx-advanced">
        <summary>Advanced</summary>
        <div className="lx-controls">
          <div className="lx-field narrow">
            <label htmlFor="lx-tr-steps">max_steps</label>
            <input
              id="lx-tr-steps"
              type="number"
              min={1}
              max={2000}
              value={maxSteps}
              onChange={(event) => setMaxSteps(event.target.value)}
            />
          </div>
          <div className="lx-field narrow">
            <label htmlFor="lx-tr-eval">eval_every</label>
            <input
              id="lx-tr-eval"
              type="number"
              min={1}
              max={500}
              value={evalEvery}
              onChange={(event) => setEvalEvery(event.target.value)}
            />
          </div>
          <div className="lx-field grow">
            <label htmlFor="lx-tr-prompt">sample_prompt</label>
            <input
              id="lx-tr-prompt"
              value={samplePrompt}
              onChange={(event) => setSamplePrompt(event.target.value)}
            />
          </div>
        </div>
        <p className="lx-deepdive" style={{ marginTop: "10px" }}>
          <code>batch_size</code> and <code>learning_rate</code> stay at their defaults here —
          moving them one at a time is Stage 05.
        </p>
      </details>
    </>
  );
}
