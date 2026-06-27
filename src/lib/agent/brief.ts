import { llmModelId, llmProvider } from "@/lib/llm";
import type { BriefInput, BriefResult } from "@/types/brief";
import { resolveEntity } from "./resolve";
import { gather } from "./gather";
import { synthesizeBrief } from "./synthesize";

/**
 * The end-to-end brief pipeline (#7): resolve → gather → synthesize.
 * Returns the full `BriefResult` contract for the API and UI.
 */
export async function generateBrief(input: BriefInput): Promise<BriefResult> {
  const start = Date.now();

  const entity = await resolveEntity(input);
  const { evidence } = await gather(entity);
  const brief = await synthesizeBrief(input, entity, evidence);

  return {
    input,
    entity,
    evidence,
    brief,
    meta: {
      generatedAt: new Date().toISOString(),
      provider: llmProvider,
      model: llmModelId,
      elapsedMs: Date.now() - start,
    },
  };
}
