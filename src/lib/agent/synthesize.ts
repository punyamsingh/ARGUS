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
  type SellerProfile,
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
/**
 * Derived-guidance shape for the model call. We ask only for `text` + `anchors`
 * (the evidence ids the guidance rests on) — `kind` is inferred afterwards from
 * whether any anchor survives grounding, so the model has one fewer thing to get
 * wrong. `anchors` may be empty for a purely strategic prompt.
 */
const modelGuidanceItem = z.object({
  text: z.string(),
  anchors: z.array(z.string()),
});
const modelBriefSchema = z.object({
  snapshot: z.string(),
  objective: z.string(),
  talkingPoints: z.array(modelBriefItem),
  riskAlerts: z.array(modelBriefItem),
  buyingSignals: z.array(modelBriefItem),
  decisionAsks: z.array(modelGuidanceItem),
  questions: z.array(modelGuidanceItem),
  fitHypotheses: z.array(modelGuidanceItem),
});

/**
 * Synthesis (#6) — turn gathered evidence into a cited Brief.
 *
 * The non-negotiable discipline: write ONLY from the evidence, cite every item
 * by evidence id, and drop any item whose citations don't resolve to real
 * evidence. Thin evidence → an honest, sparse brief, never fabrication.
 */

const SYSTEM = `You write concise, conversation-ready B2B sales pre-meeting briefs.

There are two kinds of content. Keep them distinct:

SOURCED CLAIMS — facts about the buyer. Sections: talkingPoints, riskAlerts, buyingSignals.
- Use ONLY the supplied evidence. Do not add facts from your own knowledge.
- Every sourced-claim item MUST \`cite\` at least one evidence id (the bracketed e-ids). Cite ids exactly; never invent one. No support → return an empty array.

DERIVED GUIDANCE — what the rep should do, not a public fact. Sections: decisionAsks, questions, fitHypotheses.
- These use \`anchors\`, not \`citations\`: list the evidence e-ids the guidance rests on (the signal that motivates it). \`anchors\` may be empty for a purely strategic prompt; never invent an id.
- decisionAsks: what to push for / the next step to land.
- questions: sharp discovery questions to ASK in the meeting. Anchor each to the specific signal that prompts it where possible (e.g. a hiring spike, a filing, recent news).
- fitHypotheses: where the SELLER's stated offering plausibly meets a buyer signal — framed as a hypothesis to test, not an asserted outcome. Only produce these when seller-stated context is provided, and only using capabilities the rep actually stated. Anchor to the buyer e-id that makes the offering relevant. Empty array if no seller context.

General:
- Keep each item to one or two sharp sentences a rep can say out loud.
- snapshot: one line on the company (and the person if known).
- objective: infer the meeting's goal from the provided context (and the meeting type, if given).
- Prefer specific, recent, decision-useful points over generic ones.

Seller context (when provided):
- You may be given SELLER-STATED facts about the rep's OWN company/product (ids s1, s2, …). Use them to tailor talkingPoints, decisionAsks, and especially fitHypotheses to where the seller's offering meets the buyer's situation.
- Symmetric grounding: only attribute capabilities to the seller's product that appear in the seller-stated facts. NEVER invent a product capability, integration, or claim the rep didn't state.
- Seller-stated facts are context, not public sources: do NOT put s-ids in citations or anchors. Sourced claims still cite buyer e-ids; guidance anchors are buyer e-ids only.`;

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
      riskAlerts: [],
      buyingSignals: [],
      decisionAsks: [],
      questions: [],
      fitHypotheses: [],
    };
  }

  const evidenceList = evidence
    .map((e) => `[${e.id}] (${e.tool}) ${e.claim} — ${e.sourceUrl}`)
    .join("\n");

  const personLine = entity.person.role
    ? `${entity.person.name} (${entity.person.role})`
    : entity.person.name;

  const sellerFacts = input.seller ? sellerStatedFacts(input.seller) : [];
  const sellerBlock = sellerFacts.length
    ? [
        ``,
        `Your company/product — seller-stated context (tailor to this; do NOT cite the s-ids):`,
        ...sellerFacts.map((f) => `[${f.id}] ${f.text}`),
      ]
    : [];

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
          ...(input.meetingType ? [`Meeting type: ${input.meetingType}`] : []),
          ``,
          `Resolved: ${entity.company.name}; meeting ${personLine}`,
          ...sellerBlock,
          ``,
          `Evidence (cite by id):`,
          evidenceList,
        ].join("\n"),
      }),
    (r) => ({ output: r.object, usage: r.usage }),
  );

  const validIds = new Set(evidence.map((e) => e.id));

  // Infer guidance `kind` from whether the model supplied any anchors, then let
  // groundGuidance filter anchors to real ids and downgrade if none survive.
  const asGuidance = (items: { text: string; anchors: string[] }[]) =>
    groundGuidance(
      items.map((i) => ({
        text: i.text,
        anchors: i.anchors,
        kind: i.anchors.length ? ("sourced-premise" as const) : ("strategic" as const),
      })),
      validIds,
    );

  return {
    snapshot: stripInlineCitations(object.snapshot),
    objective: stripInlineCitations(object.objective),
    talkingPoints: groundClaim(object.talkingPoints, validIds),
    riskAlerts: groundClaim(object.riskAlerts, validIds),
    buyingSignals: groundClaim(object.buyingSignals, validIds),
    decisionAsks: asGuidance(object.decisionAsks),
    questions: asGuidance(object.questions),
    fitHypotheses: asGuidance(object.fitHypotheses),
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
 * Turn the rep's seller profile into a small list of seller-stated facts with
 * stable `s`-ids. These are synthesis *context* — they constrain what the model
 * may claim about the seller's own product (the symmetric no-fabrication rule),
 * but they are not public evidence and never enter the cited Sources list. The
 * questions/fit work (#73) reuses these to anchor fit hypotheses.
 */
export function sellerStatedFacts(
  seller: SellerProfile,
): { id: string; text: string }[] {
  const facts: { id: string; text: string }[] = [];
  const push = (text: string) => facts.push({ id: `s${facts.length + 1}`, text });

  push(`${seller.company} offers: ${seller.offering}`);
  if (seller.valueProp) push(`Value proposition: ${seller.valueProp}`);
  if (seller.competitors.length) {
    push(`Named competitors: ${seller.competitors.join(", ")}`);
  }
  return facts;
}

/**
 * Remove inline evidence-id tokens the model writes into prose — `[e1]`,
 * `[e1, e3, e4]`, or runs like `[e1][e3]` — then tidy the leftover whitespace
 * and dangling punctuation so the sentence reads cleanly.
 */
function stripInlineCitations(text: string): string {
  return text
    .replace(/\s*\[\s*[es]\d+(?:\s*,\s*[es]\d+)*\s*\]/gi, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
