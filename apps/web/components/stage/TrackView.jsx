"use client";

import Link from "next/link";

import { ConceptBlock } from "./StageView";
import { TRACK_CONTENT } from "../../content/stages";

/**
 * A track uses the same blocks as a stage, minus the ladder position: it is not
 * part of the sequence and nothing later depends on it.
 */
export default function TrackView({ track }) {
  const content = TRACK_CONTENT[track.id];

  return (
    <>
      <section className="lx-card lx-stage-head">
        <span className="lx-eyebrow">Optional track · not on the ladder</span>
        <h1>{track.title}</h1>
        <p className="lx-focus">{track.focus}</p>
        <p className="lx-deepdive" style={{ marginTop: "10px" }}>
          Take it any time after Stage {track.availableAfter?.slice(0, 2)}.
        </p>
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
            {content.exitCheck.map((item) => (
              <label key={item} className="lx-check">
                <input type="checkbox" />
                <span>{item}</span>
              </label>
            ))}
          </section>
        </>
      ) : null}

      <section className="lx-card lx-stage-footer">
        <span className="lx-deepdive">
          Deep dive: <code>{track.doc}</code>
        </span>
        <Link href="/" className="lx-secondary" style={{ lineHeight: "34px", textDecoration: "none" }}>
          Back to the course map
        </Link>
      </section>
    </>
  );
}
