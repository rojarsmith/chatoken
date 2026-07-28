import curriculum from "../../../curriculum.json";

export const PARTS = curriculum.parts;
export const STAGES = curriculum.stages;
export const TRACKS = curriculum.tracks;
export const REFERENCE = curriculum.reference;

const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]));
const PART_BY_ID = new Map(PARTS.map((part) => [part.id, part]));

export function getStage(stageId) {
  return STAGE_BY_ID.get(stageId) ?? null;
}

export function getPart(partId) {
  return PART_BY_ID.get(partId) ?? null;
}

export function stagesOfPart(partId) {
  const part = getPart(partId);
  if (!part) return [];
  return part.stages.map((id) => STAGE_BY_ID.get(id)).filter(Boolean);
}

export function nextStage(stageId) {
  const index = STAGES.findIndex((stage) => stage.id === stageId);
  if (index < 0 || index + 1 >= STAGES.length) return null;
  return STAGES[index + 1];
}

export function previousStage(stageId) {
  const index = STAGES.findIndex((stage) => stage.id === stageId);
  if (index <= 0) return null;
  return STAGES[index - 1];
}

/** Prerequisites the learner has not marked done yet. Used for a warning, never a lock. */
export function missingPrerequisites(stageId, stateOf) {
  const stage = getStage(stageId);
  if (!stage) return [];
  return stage.requires
    .map((id) => STAGE_BY_ID.get(id))
    .filter((required) => required && stateOf(required.id) !== "done");
}

export const TOTAL_STAGES = STAGES.length;
