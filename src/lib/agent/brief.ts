import { llmModelId, llmProvider } from "@/lib/llm";
import type {
  Brief,
  BriefInput,
  BriefResult,
  BriefStage,
  Evidence,
  GuidanceItem,
} from "@/types/brief";
import { withObservation } from "@/lib/telemetry";
import { resolveEntity } from "./resolve";
import { gather } from "./gather";
import { synthesizeBrief } from "./synthesize";

export interface GenerateBriefOptions {
  /** Called as each stage begins, so callers can stream progress. */
  onProgress?: (stage: BriefStage) => void;
  /** Groups a user's briefs into one Langfuse session (#15). */
  sessionId?: string;
}

/**
 * The end-to-end brief pipeline (#7): resolve → gather → synthesize.
 * Returns the full `BriefResult` contract for the API and UI. `onProgress` fires
 * at the start of each stage to drive live progress in the UI (#10).
 */
export async function generateBrief(
  input: BriefInput,
  { onProgress, sessionId }: GenerateBriefOptions = {},
): Promise<BriefResult> {
  // Wrap the whole pipeline in one observation so resolve, each gather tool, and
  // synthesis nest under a single per-brief trace in Langfuse (#15). Input is set
  // to just the meeting fields (not raw args); output to a compact summary; the
  // session id groups a user's briefs in the Langfuse Sessions view.
  return withObservation(
    "brief",
    { company: input.company, person: input.person, context: input.context },
    () => runPipeline(input, onProgress),
    (result) => ({
      entity: result.entity.company.name,
      sources: result.evidence.length,
      elapsedMs: result.meta.elapsedMs,
    }),
    { sessionId, traceName: "brief" },
  );
}

async function runPipeline(
  input: BriefInput,
  onProgress?: (stage: BriefStage) => void,
): Promise<BriefResult> {
  const start = Date.now();

  onProgress?.("resolving");
  const entity = await resolveEntity(input);

  onProgress?.("gathering");
  const { evidence } = await gather(entity);

  onProgress?.("synthesizing");
  const brief = await synthesizeBrief(input, entity, evidence);

  return {
    input,
    entity,
    // Show only evidence the brief actually cites. Tools can return tangential
    // hits (e.g. a broad news match); the synthesizer correctly ignores them,
    // but leaving them in the Sources list adds noise and inflates the count.
    evidence: citedEvidence(brief, evidence),
    brief,
    meta: {
      generatedAt: new Date().toISOString(),
      provider: llmProvider,
      model: llmModelId,
      elapsedMs: Date.now() - start,
    },
  };
}

function citedEvidence(brief: Brief, evidence: Evidence[]): Evidence[] {
  const cited = new Set<string>();
  // Sourced claims cite via `citations`.
  for (const section of [
    brief.talkingPoints,
    brief.decisionAsks,
    brief.riskAlerts,
    brief.buyingSignals,
  ]) {
    for (const item of section) {
      for (const id of item.citations) cited.add(id);
    }
  }
  // Derived guidance cites via `anchors` (questions/fit, added in #73) — so a
  // guidance item's premise still renders in the Sources list. Empty until then.
  const guidanceSections: GuidanceItem[][] = [];
  for (const section of guidanceSections) {
    for (const item of section) {
      for (const id of item.anchors) cited.add(id);
    }
  }
  return evidence.filter((e) => cited.has(e.id));
}
