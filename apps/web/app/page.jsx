"use client";

import Link from "next/link";

import ConsoleShell from "../components/layout/ConsoleShell";
import { useConsole } from "../components/layout/ConsoleShell";
import { PARTS, TOTAL_STAGES, TRACKS, stagesOfPart } from "../content/curriculum";

export default function CurriculumMapPage() {
  return (
    <ConsoleShell showRail={false} showPlayground={false}>
      <CurriculumMap />
    </ConsoleShell>
  );
}

function CurriculumMap() {
  const { stateOf } = useConsole();

  return (
    <>
      <header className="lx-map-head">
        <h1>The whole course, at once</h1>
        <p>
          {TOTAL_STAGES} stages in {PARTS.length} parts. Each one teaches exactly one new idea and
          builds on the stage before it. Start at 01 and go down — you can jump, but the order is
          the lesson.
        </p>
      </header>

      <div className="lx-map-parts">
        {PARTS.map((part) => (
          <section key={part.id} className="lx-map-part">
            <h2>
              Part {part.number} · {part.title}
            </h2>
            <p>{part.tagline}</p>
            <div className="lx-map-grid">
              {stagesOfPart(part.id).map((stage) => (
                <Link key={stage.id} href={`/stage/${stage.id}`} className="lx-map-card">
                  <div className="lx-map-card-top">
                    <b>STAGE {String(stage.number).padStart(2, "0")}</b>
                    <span className={`lx-dot ${stateOf(stage.id)}`} />
                    {stage.implemented ? null : <span className="lx-soon">doc</span>}
                  </div>
                  <h3>{stage.title}</h3>
                  <p>{stage.focus}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="lx-map-part" style={{ marginTop: "6px" }}>
        <h2>Optional track</h2>
        <p>not on the ladder — nothing later depends on it</p>
        <div className="lx-map-grid">
          {TRACKS.map((track) => (
            <Link key={track.id} href={`/track/${track.id}`} className="lx-map-card">
              <div className="lx-map-card-top">
                <b>TRACK</b>
              </div>
              <h3>{track.title}</h3>
              <p>{track.focus}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="lx-card" style={{ marginTop: "18px" }}>
        <span className="lx-block-label">Reading the ladder</span>
        <p>
          Every stage has an interactive panel here, and a written stage with command-line and API
          steps that work without the console at all. The dot on each card tracks your progress —
          stages are ordered but never locked.
        </p>
        <p className="lx-deepdive">
          The full course text lives in <code>docs/README.md</code>, in English and 繁體中文.
        </p>
      </section>
    </>
  );
}
