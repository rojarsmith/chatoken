"use client";

import Link from "next/link";

import { getPart, missingPrerequisites, nextStage } from "../../content/curriculum";
import { useConsole } from "../layout/ConsoleShell";
import { STAGE_CONTENT } from "../../content/stages";

/**
 * Every stage renders the same six blocks in the same order:
 * Focus · Concept · Do · Observe · Exit check · Deep dive.
 * Consistency is what lets a learner stop navigating and start learning.
 */
export default function StageView({ stage }) {
  const { stateOf, setStageState } = useConsole();
  const content = STAGE_CONTENT[stage.id];
  const part = getPart(stage.part);
  const upcoming = nextStage(stage.id);
  const missing = missingPrerequisites(stage.id, stateOf);
  const state = stateOf(stage.id);

  return (
    <>
      <section className="lx-card lx-stage-head">
        <span className="lx-eyebrow">
          Stage {String(stage.number).padStart(2, "0")} · Part {part?.number} {part?.title}
        </span>
        <h1>{stage.title}</h1>
        <p className="lx-focus">{stage.focus}</p>

        {missing.length > 0 ? (
          <p className="lx-note">
            This stage assumes{" "}
            {missing.map((item, index) => (
              <span key={item.id}>
                {index > 0 ? ", " : ""}
                <Link href={`/stage/${item.id}`}>
                  Stage {String(item.number).padStart(2, "0")} · {item.title}
                </Link>
              </span>
            ))}
            . You have not marked it done — you can continue anyway.
          </p>
        ) : null}
      </section>

      {content ? (
        <>
          <ConceptBlock concept={content.concept} />

          <section className="lx-card">
            <span className="lx-block-label">Do</span>
            <content.Panel />
          </section>

          <section className="lx-card">
            <span className="lx-block-label">Observe</span>
            <ol>
              {content.observe.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>

          <section className="lx-card">
            <span className="lx-block-label">Exit check</span>
            <p>You may continue when all of these are true.</p>
            {content.exitCheck.map((item) => (
              <ExitCheckItem key={item} stageId={stage.id} label={item} />
            ))}
          </section>
        </>
      ) : (
        <PendingStage stage={stage} />
      )}

      <section className="lx-card lx-stage-footer">
        <span className="lx-deepdive">
          Deep dive: <code>{stage.doc}</code>
        </span>
        <span style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="lx-secondary"
            onClick={() => setStageState(stage.id, state === "done" ? "not-started" : "done")}
          >
            {state === "done" ? "Mark not done" : "Mark stage done"}
          </button>
          {upcoming ? (
            <Link href={`/stage/${upcoming.id}`} className="lx-primary" style={{ lineHeight: "38px", textDecoration: "none", display: "inline-block" }}>
              Next: {upcoming.title} →
            </Link>
          ) : null}
        </span>
      </section>
    </>
  );
}

export function ConceptBlock({ concept }) {
  if (!concept) return null;
  return (
    <section className="lx-card">
      <span className="lx-block-label">Concept</span>
      {concept.paragraphs?.map((text) => (
        <p key={text}>{text}</p>
      ))}
      {concept.flow ? <pre className="lx-flow">{concept.flow}</pre> : null}
      {concept.steps ? (
        <div className="lx-steps" style={{ marginTop: "12px" }}>
          {concept.steps.map((step) => (
            <div key={step.title} className="lx-step">
              {step.code ? <code>{step.code}</code> : null}
              <b>{step.title}</b>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      ) : null}
      {concept.table ? (
        <table className="lx-table" style={{ marginTop: "12px" }}>
          <thead>
            <tr>
              {concept.table.head.map((cell) => (
                <th key={cell}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {concept.table.rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row[0]}`}>
                {row.map((cell, index) => (
                  <td key={`${index}-${cell}`}>{index === 0 ? <code>{cell}</code> : cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {concept.note ? <p className="lx-note">{concept.note}</p> : null}
    </section>
  );
}

function ExitCheckItem({ stageId, label }) {
  const key = `chatoken.check.${stageId}.${label.slice(0, 40)}`;
  return (
    <label className="lx-check">
      <input
        type="checkbox"
        defaultChecked={typeof window !== "undefined" && window.localStorage.getItem(key) === "1"}
        onChange={(event) => {
          if (event.target.checked) window.localStorage.setItem(key, "1");
          else window.localStorage.removeItem(key);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

function PendingStage({ stage }) {
  return (
    <section className="lx-card">
      <span className="lx-block-label">No panel</span>
      <h2>This stage has no interactive panel</h2>
      <p>
        Every stage on the ladder should be wired into{" "}
        <code>content/stages/index.js</code>. This one is not, which is a bug —{" "}
        <code>scripts/check_curriculum.py</code> is meant to catch it.
      </p>
      <p>
        The written stage is complete and can be followed with its command-line and API steps:{" "}
        <code>{stage.doc}</code>
      </p>
    </section>
  );
}
