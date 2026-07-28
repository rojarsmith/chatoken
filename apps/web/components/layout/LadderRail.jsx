"use client";

import Link from "next/link";

import { PARTS, TOTAL_STAGES, stagesOfPart } from "../../content/curriculum";

export default function LadderRail({ currentStageId, stateOf, doneCount }) {
  const percent = Math.round((doneCount / TOTAL_STAGES) * 100);

  return (
    <nav className="lx-rail" aria-label="Course ladder">
      <div className="lx-rail-progress">
        <b>
          {doneCount} of {TOTAL_STAGES} stages
        </b>
        <p>Ordered, never locked — you can jump.</p>
        <div className="lx-progress-track">
          <div className="lx-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {PARTS.map((part) => (
        <section key={part.id} className="lx-part">
          <div className="lx-part-head">
            <b>
              Part {part.number} · {part.title}
            </b>
            <span>{part.tagline}</span>
          </div>

          {stagesOfPart(part.id).map((stage) => {
            const state = stateOf(stage.id);
            const isCurrent = stage.id === currentStageId;
            return (
              <Link
                key={stage.id}
                href={`/stage/${stage.id}`}
                className={`lx-stage-link${isCurrent ? " current" : ""}`}
                aria-current={isCurrent ? "page" : undefined}
              >
                <span className="lx-stage-num">
                  {String(stage.number).padStart(2, "0")}
                </span>
                <span className="lx-stage-title">{stage.title}</span>
                {stage.implemented ? null : <span className="lx-soon">doc</span>}
                <span className={`lx-dot ${state}`} title={state} />
              </Link>
            );
          })}
        </section>
      ))}
    </nav>
  );
}
