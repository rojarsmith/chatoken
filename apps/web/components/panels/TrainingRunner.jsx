"use client";

import { useEffect, useState } from "react";
import { Download, LoaderCircle, Play } from "lucide-react";

import { api, JOB_ENDPOINTS } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction, useJob } from "../../lib/hooks";
import { ApiOfflineNote, JobStatus, LossTable, Metric, Metrics, SampleCompare } from "../ui/Bits";

/**
 * Stages 10-13 all run a fine-tuning job against GPT-2 — only the dataset, the
 * settings, and the numbers worth highlighting differ. Sharing the runner keeps
 * each stage panel about its own idea instead of about job plumbing.
 */
export default function TrainingRunner({
  datasetId,
  outputModelId,
  baseModelId = "gpt2-124M",
  defaults,
  samplePrompt,
  runLabel = "Run fine-tuning",
  extraMetrics,
  beforeLabel = "Before",
  afterLabel = "After",
  children
}) {
  const { apiBaseUrl, status, models, refresh, setModelId } = useConsole();
  const [settings, setSettings] = useState(defaults);

  const datasets = useAction(() => api.datasets(apiBaseUrl));
  const prepare = useAction(() => api.prepareDataset(apiBaseUrl, datasetId));
  const job = useJob(apiBaseUrl, JOB_ENDPOINTS.training);

  useEffect(() => {
    if (status === "online") datasets.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, apiBaseUrl]);

  const spec = (datasets.result ?? []).find((item) => item.dataset_id === datasetId);
  const baseLoaded = models.some((item) => item.model_id === baseModelId);
  const summary = job.job?.result?.training_summary ?? null;
  const ready = spec?.exists && baseLoaded && status === "online";

  async function run() {
    const created = await job.start({
      dataset_id: datasetId,
      base_model_id: baseModelId,
      output_model_id: outputModelId,
      ...settings,
      sample_prompt: samplePrompt,
      load_when_complete: true
    });
    if (!created) return;
    const poll = async () => {
      const next = await api.trainingJob(apiBaseUrl, created.job_id);
      if (next.status === "succeeded") {
        refresh();
        setModelId(outputModelId);
      } else if (next.status === "running" || next.status === "queued") {
        setTimeout(poll, 900);
      }
    };
    setTimeout(poll, 900);
  }

  return (
    <>
      {children}

      <ApiOfflineNote status={status} />

      <Metrics>
        <Metric label="Dataset" value={datasetId} hint={spec?.exists ? "ready" : "not downloaded"} />
        <Metric label="Base model" value={baseModelId} hint={baseLoaded ? "loaded" : "not loaded"} />
        <Metric label="Output" value={outputModelId} />
        {spec?.train_examples !== undefined ? (
          <Metric label="Train examples" value={spec.train_examples} />
        ) : null}
      </Metrics>

      {!baseLoaded && status === "online" ? (
        <p className="lx-note">
          <code>{baseModelId}</code> is not loaded. Go to{" "}
          <strong>Stage 08 · Pretrained GPT-2</strong> and load it first — loaded models live in
          memory, so restarting the API clears them.
        </p>
      ) : null}

      <div className="lx-controls" style={{ marginTop: "14px" }}>
        <button type="button" className="lx-primary" disabled={!ready || job.running || job.starting} onClick={run}>
          {job.running || job.starting ? <LoaderCircle size={15} /> : <Play size={15} />} {runLabel}
        </button>
        {spec && !spec.exists ? (
          <button
            type="button"
            className="lx-secondary"
            disabled={prepare.pending}
            onClick={async () => {
              await prepare.run();
              datasets.run();
            }}
          >
            <Download size={13} /> Prepare dataset
          </button>
        ) : null}
      </div>

      {prepare.error ? <p className="lx-error">{prepare.error}</p> : null}

      <JobStatus job={job.job} error={job.error} onCancel={job.cancel} />
      <LossTable progress={job.job?.progress} />

      {summary ? (
        <>
          <Metrics>
            <Metric label="Final loss" value={summary.final_loss?.toFixed(4)} />
            <Metric label="Tuning method" value={summary.tuning_method} />
            <Metric
              label="Trainable"
              value={`${summary.trainable_percent}%`}
              hint={`${summary.trainable_parameters?.toLocaleString()} of ${summary.total_parameters?.toLocaleString()}`}
            />
            <Metric label="Device" value={summary.device} />
            {extraMetrics?.(summary)}
          </Metrics>

          <SampleCompare
            before={summary.before_sample}
            after={summary.sample_text}
            beforeLabel={beforeLabel}
            afterLabel={afterLabel}
          />
        </>
      ) : null}

      <details className="lx-advanced">
        <summary>Advanced</summary>
        <div className="lx-controls" style={{ marginTop: "12px" }}>
          {Object.keys(defaults).map((key) => (
            <div key={key} className="lx-field narrow">
              <label htmlFor={`lx-run-${key}`}>{key}</label>
              <input
                id={`lx-run-${key}`}
                type="number"
                step={key === "learning_rate" ? 0.00001 : 1}
                value={settings[key]}
                onChange={(event) =>
                  setSettings({ ...settings, [key]: Number(event.target.value) })
                }
              />
            </div>
          ))}
          <button type="button" className="lx-secondary" onClick={() => setSettings(defaults)}>
            Reset
          </button>
        </div>
      </details>
    </>
  );
}
