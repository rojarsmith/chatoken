"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows } from "lucide-react";

import { api } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction } from "../../lib/hooks";
import { escapeForDisplay } from "../../lib/format";
import { ApiOfflineNote, Metric, Metrics } from "../ui/Bits";

const SAME_LABEL = {
  prompt: "Same prompt",
  dataset: "Same dataset",
  base_model: "Same base model",
  objective: "Same objective",
  tuning: "Same tuning method"
};

/** Stage 14. The sameness summary comes first, deliberately. */
export default function ExperimentsPanel() {
  const { apiBaseUrl, status } = useConsole();
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  const experiments = useAction(() => api.experiments(apiBaseUrl));
  const compare = useAction((l, r) => api.compareExperiments(apiBaseUrl, l, r));

  useEffect(() => {
    if (status === "online") experiments.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, apiBaseUrl]);

  const list = experiments.result ?? [];
  useEffect(() => {
    if (list.length >= 2 && !leftId && !rightId) {
      setLeftId(list[1].experiment_id);
      setRightId(list[0].experiment_id);
    }
  }, [list, leftId, rightId]);

  const result = compare.result;
  const same = result?.same ?? null;
  const mismatches = same ? Object.entries(same).filter(([, value]) => !value) : [];

  const label = (item) =>
    `${item.output_model_id} · ${item.dataset_id} · ${item.tuning_method ?? "full"} · loss ${
      item.final_loss ?? "—"
    }`;

  return (
    <>
      <p>
        A loss number means nothing on its own. Before comparing two runs, five things must
        match — so this panel reports those first, and the metrics second.
      </p>

      <ApiOfflineNote status={status} />
      {experiments.error ? <p className="lx-error">{experiments.error}</p> : null}

      {list.length < 2 && status === "online" ? (
        <p className="lx-note">
          You need at least two recorded runs. <code>models/experiments/</code> is git-ignored, so
          a fresh clone starts empty — Stage 04 onward fills it.
        </p>
      ) : null}

      {list.length >= 2 ? (
        <>
          <div className="lx-controls">
            <div className="lx-field grow">
              <label htmlFor="lx-ex-left">Left run</label>
              <select id="lx-ex-left" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
                {list.map((item) => (
                  <option key={item.experiment_id} value={item.experiment_id}>
                    {label(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="lx-field grow">
              <label htmlFor="lx-ex-right">Right run</label>
              <select id="lx-ex-right" value={rightId} onChange={(e) => setRightId(e.target.value)}>
                {list.map((item) => (
                  <option key={item.experiment_id} value={item.experiment_id}>
                    {label(item)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="lx-primary"
              disabled={compare.pending || !leftId || !rightId}
              onClick={() => compare.run(leftId, rightId)}
            >
              <GitCompareArrows size={15} /> Compare
            </button>
          </div>
          {compare.error ? <p className="lx-error">{compare.error}</p> : null}
        </>
      ) : null}

      {same ? (
        <>
          <span className="lx-block-label" style={{ marginTop: "16px" }}>
            1. Is this comparison valid?
          </span>
          <table className="lx-table">
            <tbody>
              {Object.entries(same).map(([key, value]) => (
                <tr key={key}>
                  <td>{SAME_LABEL[key] ?? key}</td>
                  <td>
                    <span className={`lx-pill ${value ? "online" : "offline"}`}>
                      {value ? "same" : "different"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {mismatches.length ? (
            <p className="lx-note">
              {mismatches.length} of 5 fields differ. A lower loss on either side proves nothing
              here — you are comparing two different experiments, not two versions of one.
            </p>
          ) : (
            <p className="lx-note">
              All five match. The metrics below are comparable.
            </p>
          )}

          {result.notes?.length ? (
            <ul style={{ marginTop: "10px" }}>
              {result.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}

          <span className="lx-block-label" style={{ marginTop: "16px" }}>
            2. What changed
          </span>
          <Metrics>
            {Object.entries(result.deltas ?? {}).map(([key, delta]) =>
              delta ? (
                <Metric
                  key={key}
                  label={key}
                  value={`${delta.left ?? "—"} → ${delta.right ?? "—"}`}
                  hint={delta.delta !== undefined ? `Δ ${delta.delta}` : undefined}
                />
              ) : null
            )}
          </Metrics>

          <span className="lx-block-label" style={{ marginTop: "16px" }}>
            3. Only now, the samples
          </span>
          <div className="lx-compare">
            <div>
              <p className="lx-deepdive">{result.left?.output_model_id}</p>
              <pre className="lx-code">
                {escapeForDisplay(result.left?.after_sample ?? result.left?.sample_text) || "(none)"}
              </pre>
            </div>
            <div>
              <p className="lx-deepdive">{result.right?.output_model_id}</p>
              <pre className="lx-code">
                {escapeForDisplay(result.right?.after_sample ?? result.right?.sample_text) || "(none)"}
              </pre>
            </div>
          </div>
        </>
      ) : null}

      <p className="lx-note">
        Generated text is the most persuasive and least reliable evidence available. Reading it
        before the summary is how people convince themselves of things that are not true.
      </p>
    </>
  );
}
