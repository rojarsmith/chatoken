"use client";

import { useEffect, useState } from "react";
import { Plus, Sprout, Trash2 } from "lucide-react";

import { api } from "../../lib/api";
import { useConsole } from "../layout/ConsoleShell";
import { useAction } from "../../lib/hooks";
import { ApiOfflineNote, Metric, Metrics } from "../ui/Bits";
import TrainingRunner from "./TrainingRunner";

const EMPTY = { instruction: "", input: "", output: "", split: "train" };

/** Stage 13. Write the data yourself, and keep an eval split honest. */
export default function DatasetBuilderPanel() {
  const { apiBaseUrl, status } = useConsole();
  const [draft, setDraft] = useState(EMPTY);

  const builder = useAction(() => api.datasetBuilder(apiBaseUrl));
  const seed = useAction(() => api.seedDatasetBuilder(apiBaseUrl));
  const add = useAction((body) => api.addBuilderExample(apiBaseUrl, body));
  const remove = useAction((id) => api.deleteBuilderExample(apiBaseUrl, id));

  useEffect(() => {
    if (status === "online") builder.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, apiBaseUrl]);

  const data = builder.result;
  const examples = data?.examples ?? [];
  const trainCount = examples.filter((item) => item.split === "train").length;
  const evalCount = examples.filter((item) => item.split === "eval").length;

  return (
    <>
      <p>
        Every dataset so far arrived ready-made. This one is yours. Examples marked{" "}
        <code>train</code> become optimizer updates; examples marked <code>eval</code> are stored
        and never trained on.
      </p>

      <ApiOfflineNote status={status} />
      {builder.error ? <p className="lx-error">{builder.error}</p> : null}

      <Metrics>
        <Metric label="Train examples" value={trainCount} hint="these update the model" />
        <Metric label="Eval examples" value={evalCount} hint="held out" />
        <Metric label="Total" value={examples.length} />
      </Metrics>

      {examples.length === 0 ? (
        <button
          type="button"
          className="lx-secondary"
          style={{ marginTop: "12px" }}
          disabled={seed.pending}
          onClick={async () => {
            await seed.run();
            builder.run();
          }}
        >
          <Sprout size={13} /> Seed starter examples
        </button>
      ) : null}

      <div className="lx-controls" style={{ marginTop: "14px" }}>
        <div className="lx-field grow">
          <label htmlFor="lx-db-instruction">Instruction</label>
          <input
            id="lx-db-instruction"
            value={draft.instruction}
            onChange={(event) => setDraft({ ...draft, instruction: event.target.value })}
          />
        </div>
        <div className="lx-field narrow">
          <label htmlFor="lx-db-split">split</label>
          <select
            id="lx-db-split"
            value={draft.split}
            onChange={(event) => setDraft({ ...draft, split: event.target.value })}
          >
            <option value="train">train</option>
            <option value="eval">eval</option>
          </select>
        </div>
      </div>
      <div className="lx-field" style={{ marginTop: "10px" }}>
        <label htmlFor="lx-db-output">Output</label>
        <input
          id="lx-db-output"
          value={draft.output}
          onChange={(event) => setDraft({ ...draft, output: event.target.value })}
        />
      </div>
      <button
        type="button"
        className="lx-secondary"
        style={{ marginTop: "10px" }}
        disabled={add.pending || !draft.instruction.trim() || !draft.output.trim()}
        onClick={async () => {
          await add.run(draft);
          setDraft(EMPTY);
          builder.run();
        }}
      >
        <Plus size={13} /> Add example
      </button>
      {add.error ? <p className="lx-error">{add.error}</p> : null}

      {examples.length ? (
        <table className="lx-table" style={{ marginTop: "14px" }}>
          <thead>
            <tr>
              <th>Split</th>
              <th>Instruction</th>
              <th>Output</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {examples.map((item) => (
              <tr key={item.example_id}>
                <td>
                  <code>{item.split}</code>
                </td>
                <td>{item.instruction}</td>
                <td>{item.output}</td>
                <td>
                  <button
                    type="button"
                    className="lx-secondary"
                    onClick={async () => {
                      await remove.run(item.example_id);
                      builder.run();
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <p className="lx-note">
        In this implementation <code>eval</code> examples are saved for inspection rather than
        scored automatically. The split exists; the discipline is yours — hold them out{" "}
        <em>before</em> you look at results, or they prove nothing.
      </p>

      <div style={{ marginTop: "18px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
        <TrainingRunner
          datasetId="instruction-builder"
          outputModelId="gpt2-builder-finetuned"
          defaults={{ max_steps: 20, batch_size: 1, block_size: 256, learning_rate: 0.00005, eval_every: 5 }}
          samplePrompt="Explain what a model checkpoint is in one sentence."
          runLabel="Train on your examples"
          beforeLabel="Before (GPT-2 base)"
          afterLabel="After (custom SFT)"
        >
          <p>
            Train on the <code>train</code> rows above, then ask the model one of your{" "}
            <code>eval</code> instructions in the Playground and judge the answer yourself.
          </p>
        </TrainingRunner>
      </div>
    </>
  );
}
