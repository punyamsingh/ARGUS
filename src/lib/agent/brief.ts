import { llmModelId, llmProvider } from "@/lib/llm";
import type {
  Brief,
  BriefInput,
  BriefResult,
  BriefStage,
  Evidence,
} from "@/types/brief";
import { resolveEntity } from "./resolve";
import { gather } from "./gather";
import { synthesizeBrief } from "./synthesize";

export interface GenerateBriefOptions {
  /** Called as each stage begins, so callers can stream progress. */
  onProgress?: (stage: BriefStage) => void;
}

/**
 * The end-to-end brief pipeline (#7): resolve → gather → synthesize.
 * Returns the full `BriefResult` contract for the API and UI. `onProgress` fires
 * at the start of each stage to drive live progress in the UI (#10).
 */
export async function generateBrief(
  input: BriefInput,
  { onProgress }: GenerateBriefOptions = {},
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
  return evidence.filter((e) => cited.has(e.id));
}
