"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import ConsoleShell from "../../../components/layout/ConsoleShell";
import StageView from "../../../components/stage/StageView";
import { getStage } from "../../../content/curriculum";

export default function StagePage() {
  const params = useParams();
  const stageId = Array.isArray(params.stageId) ? params.stageId[0] : params.stageId;
  const stage = getStage(stageId);

  if (!stage) {
    return (
      <ConsoleShell showPlayground={false}>
        <section className="lx-card">
          <h1>Unknown stage</h1>
          <p>
            There is no stage with the id <code>{stageId}</code>.
          </p>
          <p>
            <Link href="/">Back to the course map</Link>
          </p>
        </section>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell currentStageId={stage.id}>
      <StageView stage={stage} />
    </ConsoleShell>
  );
}
