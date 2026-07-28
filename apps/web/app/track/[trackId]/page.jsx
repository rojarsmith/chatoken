"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import ConsoleShell from "../../../components/layout/ConsoleShell";
import TrackView from "../../../components/stage/TrackView";
import { TRACKS } from "../../../content/curriculum";

export default function TrackPage() {
  const params = useParams();
  const trackId = Array.isArray(params.trackId) ? params.trackId[0] : params.trackId;
  const track = TRACKS.find((item) => item.id === trackId);

  if (!track) {
    return (
      <ConsoleShell showPlayground={false}>
        <section className="lx-card">
          <h1>Unknown track</h1>
          <p>
            There is no track with the id <code>{trackId}</code>.
          </p>
          <p>
            <Link href="/">Back to the course map</Link>
          </p>
        </section>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell>
      <TrackView track={track} />
    </ConsoleShell>
  );
}
