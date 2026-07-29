"use client";

import Assistant from "../../components/assistant/Assistant";

/**
 * The product the course builds up to: a working chat assistant running on the
 * model you trained, with sessions, streaming, and settings. Deliberately kept
 * outside the stage ladder — this is the demo, not a lesson.
 */
export default function AssistantPage() {
  return <Assistant />;
}
