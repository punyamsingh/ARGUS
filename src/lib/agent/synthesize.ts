import { generateObject } from "ai";
import { z } from "zod";
import { getModel, llmDefaults, llmModelId } from "@/lib/llm";
import { withGeneration } from "@/lib/telemetry";
import {
  type Brief,
  type BriefInput,
  type Evidence,
  type ResolvedEntity,
  type SellerProfile,
} from "@/types/brief";
import { groundClaim, groundGuidance, stripInlineCitations } from "./grounding";

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

