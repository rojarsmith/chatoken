"use client";

import { useEffect } from "react";
import { Download, LoaderCircle } from "lucide-react";

import { api, JOB_ENDPOINTS } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction, useJob } from "../../lib/hooks";
import { formatNumber } from "../../lib/format";
import { ApiOfflineNote, JobStatus, Metric, Metrics } from "../ui/Bits";

const TINY = { params: 136704, vocab: 257, ctx: 64, emb: 64, heads: 4, layers: 2 };
const GPT2_SMALL = { vocab: 50257, ctx: 1024, emb: 768, heads: 12, layers: 12 };

// Hugging Face ties lm_head to wte, so "124M" is the canonical tied count.
// This project keeps a separate out_head, which adds emb_dim × vocab_size.
const GPT2_TIED_PARAMS = 124_439_808;
const GPT2_UNTIED_HEAD = GPT2_SMALL.emb * GPT2_SMALL.vocab;

/** Stage 08. Same GPTModel, different numbers — and a ~500 MB download. */
export default function PretrainedPanel() {
  const { apiBaseUrl, status, models, refresh, setModelId } = useConsole();

  const available = useAction(() => api.pretrainedModels(apiBaseUrl));
  const job = useJob(apiBaseUrl, JOB_ENDPOINTS.pretrained);

  useEffect(() => {
    if (status === "online") available.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, apiBaseUrl]);

  const small = (available.result ?? []).find((item) => item.model_size === "124M");
  const loaded = models.find((item) => item.model_id === "gpt2-124M");
  const lastEvent = job.job?.progress?.[job.job.progress.length - 1] ?? null;

  async function run() {
    const created = await job.start({ model_size: "124M" });
    if (!created) return;
    const poll = async () => {
      const next = await api.pretrainedJob(apiBaseUrl, created.job_id);
      if (next.status === "succeeded") {
        refresh();
        setModelId("gpt2-124M");
        available.run();
      } else if (next.status === "running" || next.status === "queued") {
        setTimeout(poll, 900);
      }
    };
    setTimeout(poll, 900);
  }

  return (
    <>
      <p>
        Load GPT-2 small into the <code>GPTModel</code> class you have been using since Stage 02.
        No new model code is written — only the config numbers change.
      </p>

      <ApiOfflineNote status={status} />
      {available.error ? <p className="lx-error">{available.error}</p> : null}

      <table className="lx-table">
        <thead>
          <tr>
            <th>Config field</th>
            <th>random-tiny-byte</th>
            <th>gpt2-124M</th>
          </tr>
        </thead>
        <tbody>
          {[
            [
              "parameters",
              formatNumber(TINY.params),
              formatNumber(loaded?.parameters ?? GPT2_TIED_PARAMS + GPT2_UNTIED_HEAD)
            ],
            ["vocab_size", TINY.vocab, formatNumber(GPT2_SMALL.vocab)],
            ["context_length", TINY.ctx, formatNumber(GPT2_SMALL.ctx)],
            ["emb_dim", TINY.emb, GPT2_SMALL.emb],
            ["n_heads", TINY.heads, GPT2_SMALL.heads],
            ["n_layers", TINY.layers, GPT2_SMALL.layers],
            ["tokenizer", "byte", "gpt2 (BPE)"],
            ["prompt_style", "chat", "instruction"]
          ].map(([field, tiny, gpt2]) => (
            <tr key={field}>
              <td>
                <code>{field}</code>
              </td>
              <td>{tiny}</td>
              <td>{gpt2}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="lx-note">
        That is roughly <strong>1,190× more parameters</strong> in the same code. The weights come
        from <code>openai-community/gpt2</code>; <code>_load_hf_gpt2_weights</code> maps Hugging
        Face parameter names onto this project&apos;s layers.
      </p>

      <p className="lx-note">
        <strong>Why is it not 124M?</strong> Hugging Face ties GPT-2&apos;s output head to the
        token embedding, and &ldquo;124M&rdquo; is that tied count ({formatNumber(GPT2_TIED_PARAMS)}
        ). This project keeps a separate <code>out_head</code>, which adds{" "}
        <code>emb_dim × vocab_size</code> = {formatNumber(GPT2_UNTIED_HEAD)} more, so the loaded
        model reports {formatNumber(GPT2_TIED_PARAMS + GPT2_UNTIED_HEAD)}. The weights are
        identical — the head is a copy of <code>wte</code>, not new knowledge.
      </p>

      <div className="lx-controls" style={{ marginTop: "14px" }}>
        <button
          type="button"
          className="lx-primary"
          disabled={job.running || job.starting || status !== "online"}
          onClick={run}
        >
          {job.running || job.starting ? <LoaderCircle size={15} /> : <Download size={15} />}
          {small?.downloaded ? " Load GPT-2 small" : " Download & load GPT-2 small"}
        </button>
        {small ? (
          <span className={`lx-pill ${small.downloaded ? "online" : ""}`}>
            {small.downloaded ? "already downloaded" : "~500 MB download"}
          </span>
        ) : null}
      </div>

      <JobStatus job={job.job} error={job.error} onCancel={job.cancel} />

      {lastEvent ? (
        <p className="lx-deepdive" style={{ marginTop: "10px" }}>
          Latest event: <code>{JSON.stringify(lastEvent)}</code>
        </p>
      ) : null}

      {loaded ? (
        <>
          <Metrics>
            <Metric label="Loaded" value={loaded.model_id} />
            <Metric label="Parameters" value={loaded.parameters} />
            <Metric label="Context length" value={loaded.context_length} />
            <Metric label="Tokenizer" value={loaded.tokenizer} />
            <Metric label="Prompt style" value={loaded.prompt_style} />
          </Metrics>
          <p className="lx-note">
            Now send it two things in the Playground: a continuation such as{" "}
            <em>Every effort moves you</em>, and a request such as{" "}
            <em>Explain what a model checkpoint is in one sentence.</em> Read the second one
            carefully — GPT-2 is a base model and will continue the text rather than answer it.
            That gap is Stage 09 and Stage 10.
          </p>
        </>
      ) : null}

      <details className="lx-advanced">
        <summary>Other sizes</summary>
        <table className="lx-table" style={{ marginTop: "12px" }}>
          <thead>
            <tr>
              <th>Size</th>
              <th>Parameters</th>
              <th>Downloaded</th>
            </tr>
          </thead>
          <tbody>
            {(available.result ?? []).map((item) => (
              <tr key={item.model_size}>
                <td>
                  <code>{item.model_id}</code> {item.recommended ? "· recommended" : ""}
                </td>
                <td>{formatNumber(item.parameters)}</td>
                <td>{item.downloaded ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="lx-deepdive" style={{ marginTop: "10px" }}>
          Stay on 124M for this course. Larger sizes download and train far more slowly without
          teaching anything new.
        </p>
      </details>
    </>
  );
}
