import { generateObject } from "ai";
import { z } from "zod";
import { getModel, llmDefaults, llmModelId } from "@/lib/llm";
import { withGeneration } from "@/lib/telemetry";
import {
  type Brief,
  type BriefInput,
  type BriefItem,
  type Evidence,
  type GuidanceItem,
  type ResolvedEntity,
} from "@/types/brief";

/**
 * Lenient schema for the model call. We deliberately drop the canonical
 * `Brief`'s `citations.min(1)` here: structured-output backends (e.g. Gemini)
 * have limited JSON-Schema support and may reject `minItems`. Grounding is
 * enforced after generation by dropping items without valid citations, so the
 * returned value still satisfies the strict `Brief` contract.
 */
const modelBriefItem = z.object({
  text: z.string(),
  citations: z.array(z.string()),
});
const modelBriefSchema = z.object({
  snapshot: z.string(),
  objective: z.string(),
  talkingPoints: z.array(modelBriefItem),
  decisionAsks: z.array(modelBriefItem),
  riskAlerts: z.array(modelBriefItem),
  buyingSignals: z.array(modelBriefItem),
});

/**
 * Synthesis (#6) — turn gathered evidence into a cited Brief.
 *
 * The non-negotiable discipline: write ONLY from the evidence, cite every item
 * by evidence id, and drop any item whose citations don't resolve to real
 * evidence. Thin evidence → an honest, sparse brief, never fabrication.
 */

const SYSTEM = `You write concise, conversation-ready B2B sales pre-meeting briefs.

Rules:
- Use ONLY the supplied evidence. Do not add facts from your own knowledge.
- Every item in talkingPoints, decisionAsks, riskAlerts, and buyingSignals MUST cite at least one evidence id (the bracketed ids in the evidence list). Cite the ids exactly.
- Never invent an evidence id. If a section has no support in the evidence, return an empty array for it.
- Keep each item to one or two sharp sentences a rep can say out loud.
- snapshot: one line on the company (and the person if known).
- objective: infer the meeting's goal from the provided context.
- Prefer specific, recent, decision-useful points over generic ones.`;

export async function synthesizeBrief(
  input: BriefInput,
  entity: ResolvedEntity,
  evidence: Evidence[],
): Promise<Brief> {
  // No evidence → honest minimal brief; never fabricate.
  if (evidence.length === 0) {
    return {
      snapshot: entity.company.industry
        ? `${entity.company.name} — ${entity.company.industry}`
        : entity.company.name,
      objective: input.context,
      talkingPoints: [],
      decisionAsks: [],
      riskAlerts: [],
      buyingSignals: [],
    };
  }

  const evidenceList = evidence
    .map((e) => `[${e.id}] (${e.tool}) ${e.claim} — ${e.sourceUrl}`)
    .join("\n");

  const personLine = entity.person.role
    ? `${entity.person.name} (${entity.person.role})`
    : entity.person.name;

  const { object } = await withGeneration(
    "synthesize-brief",
    {
      model: llmModelId,
      input: { entity: entity.company.name, evidenceCount: evidence.length },
    },
    () =>
      generateObject({
        model: getModel(),
        schema: modelBriefSchema,
        maxRetries: llmDefaults.maxRetries,
        abortSignal: AbortSignal.timeout(25_000),
        system: SYSTEM,
        prompt: [
          `Meeting input:`,
          `Company: ${input.company}`,
          `Person: ${input.person}`,
          `Context: ${input.context}`,
          ``,
          `Resolved: ${entity.company.name}; meeting ${personLine}`,
          ``,
          `Evidence (cite by id):`,
          evidenceList,
        ].join("\n"),
      }),
    (r) => ({ output: r.object, usage: r.usage }),
  );

  const validIds = new Set(evidence.map((e) => e.id));

  return {
    snapshot: stripInlineCitations(object.snapshot),
    objective: stripInlineCitations(object.objective),
    talkingPoints: groundClaim(object.talkingPoints, validIds),
    decisionAsks: groundClaim(object.decisionAsks, validIds),
    riskAlerts: groundClaim(object.riskAlerts, validIds),
    buyingSignals: groundClaim(object.buyingSignals, validIds),
  };
}

/**
 * Ground a **sourced claim** section: keep only citations that resolve to real
 * evidence and drop any item left unsupported — no source, no item. The model
 * often echoes the ids inline in prose ("…apps. [e1, e3]"); strip those so the
 * UI's own citation chips are the single source of truth.
 */
export function groundClaim(
  items: BriefItem[],
  validIds: Set<string>,
): BriefItem[] {
  return items
    .map((item) => ({
      text: stripInlineCitations(item.text),
      citations: item.citations.filter((c) => validIds.has(c)),
    }))
    .filter((item) => item.text.length > 0 && item.citations.length > 0);
}

/**
 * Ground a **derived guidance** section (questions, fit hypotheses, follow-up
 * answers — #73/#74). Unlike a claim, guidance is kept even with no anchors, but
 * its `anchors` are filtered to real ids (never fabricated) and a
 * "sourced-premise" item whose anchors don't resolve is downgraded to
 * "strategic" so it is never presented as resting on a citation it lacks.
 */
export function groundGuidance(
  items: GuidanceItem[],
  validIds: Set<string>,
): GuidanceItem[] {
  return items
    .map((item) => {
      const anchors = item.anchors.filter((a) => validIds.has(a));
      return {
        text: stripInlineCitations(item.text),
        anchors,
        kind:
          item.kind === "sourced-premise" && anchors.length === 0
            ? ("strategic" as const)
            : item.kind,
      };
    })
    .filter((item) => item.text.length > 0);
}

/**
 * Remove inline evidence-id tokens the model writes into prose — `[e1]`,
 * `[e1, e3, e4]`, or runs like `[e1][e3]` — then tidy the leftover whitespace
 * and dangling punctuation so the sentence reads cleanly.
 */
function stripInlineCitations(text: string): string {
  return text
    .replace(/\s*\[\s*e\d+(?:\s*,\s*e\d+)*\s*\]/gi, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
