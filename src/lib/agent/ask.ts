import { generateObject } from "ai";
import { z } from "zod";
import { getModel, llmDefaults, llmModelId, llmProvider } from "@/lib/llm";
import { withGeneration, withObservation } from "@/lib/telemetry";
import type {
  AskInput,
  AskResult,
  AskStage,
  Evidence,
  ResolvedEntity,
  BriefInput,
} from "@/types/brief";
import { gather } from "./gather";
import { sellerStatedFacts, stripInlineCitations } from "./synthesize";

/**
 * Grounded follow-up engine (#74) — the conversational layer.
 *
 * A follow-up is just synthesis over the evidence store: answer ONLY from the
 * brief's evidence, cite it, and if it can't be answered, gather fresh signals
 * for the same entity and try once more — never free-associate. If still
 * unsupported, say so honestly. This keeps the citation moat intact in chat.
 */

const SYSTEM = `You answer a B2B sales rep's follow-up question about a meeting, grounded ONLY in the supplied evidence.

Rules:
- Use ONLY the supplied evidence (the bracketed e-ids) and any seller-stated context. Never add facts from your own knowledge.
- Cite the e-ids your answer rests on, exactly — one or more. Cite seller-stated s-ids never; they are context, not public sources.
- If the evidence does not contain the answer, set answerable=false and reply in one or two sentences that there's no public signal on that yet (you may suggest what to ask the buyer instead). Do NOT guess or invent.
- Keep a supported answer to two or three sharp sentences a rep can say out loud.`;

/** Lenient model schema — grounding is enforced after generation. */
const modelAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.string()),
  answerable: z.boolean(),
});

export interface AnswerOptions {
  /** Fires as each stage begins, to stream progress. */
  onProgress?: (stage: AskStage) => void;
  /** Groups follow-ups into the same Langfuse session as the brief (#15). */
  sessionId?: string;
}

export async function answerFollowUp(
  params: AskInput,
  { onProgress, sessionId }: AnswerOptions = {},
): Promise<AskResult> {
  return withObservation(
    "ask",
    { question: params.question, entity: params.entity.company.name },
    () => run(params, onProgress),
    (r) => ({ supported: r.supported, sources: r.evidence.length }),
    { sessionId, traceName: "ask" },
  );
}

async function run(
  params: AskInput,
  onProgress?: (stage: AskStage) => void,
): Promise<AskResult> {
  const start = Date.now();
  const { question, input, entity } = params;
  let evidence = params.evidence;

  onProgress?.("thinking");
  let pass = await answerOnce(question, input, entity, evidence);

  // Gather-on-demand: if the brief's evidence can't answer it, fetch fresh
  // signals for the same entity and try once more (only if that adds anything).
  const grounded = (p: typeof pass) =>
    p.answerable && groundCitations(p.citations, evidence).length > 0;

  if (!grounded(pass)) {
    onProgress?.("gathering");
    const { evidence: fresh } = await gather(entity);
    const expanded = mergeEvidence(evidence, fresh);
    if (expanded.length > evidence.length) {
      evidence = expanded;
      onProgress?.("thinking");
      pass = await answerOnce(question, input, entity, evidence);
    }
  }

  const citations = groundCitations(pass.citations, evidence);
  const supported = pass.answerable && citations.length > 0;
  const cited = new Set(citations);

  return {
    question,
    answer: stripInlineCitations(pass.answer),
    citations,
    supported,
    // Only the evidence the answer actually cites — its own source list.
    evidence: supported ? evidence.filter((e) => cited.has(e.id)) : [],
    meta: {
      generatedAt: new Date().toISOString(),
      provider: llmProvider,
      model: llmModelId,
      elapsedMs: Date.now() - start,
    },
  };
}

async function answerOnce(
  question: string,
  input: BriefInput,
  entity: ResolvedEntity,
  evidence: Evidence[],
): Promise<z.infer<typeof modelAnswerSchema>> {
  const evidenceList =
    evidence.map((e) => `[${e.id}] (${e.tool}) ${e.claim} — ${e.sourceUrl}`).join("\n") ||
    "(no evidence yet)";

  const sellerFacts = input.seller ? sellerStatedFacts(input.seller) : [];
  const sellerBlock = sellerFacts.length
    ? [
        ``,
        `Seller-stated context (do NOT cite the s-ids):`,
        ...sellerFacts.map((f) => `[${f.id}] ${f.text}`),
      ]
    : [];

  const personLine = entity.person.role
    ? `${entity.person.name} (${entity.person.role})`
    : entity.person.name;

  const { object } = await withGeneration(
    "answer-followup",
    { model: llmModelId, input: { question } },
    () =>
      generateObject({
        model: getModel(),
        schema: modelAnswerSchema,
        maxRetries: llmDefaults.maxRetries,
        abortSignal: AbortSignal.timeout(25_000),
        system: SYSTEM,
        prompt: [
          `Meeting: ${entity.company.name}; ${personLine}`,
          `Context: ${input.context}`,
          ...sellerBlock,
          ``,
          `Follow-up question: ${question}`,
          ``,
          `Evidence (cite by id):`,
          evidenceList,
        ].join("\n"),
      }),
    (r) => ({ output: r.object, usage: r.usage }),
  );

  return object;
}

/** Keep only citations that resolve to real evidence, de-duplicated. */
function groundCitations(citations: string[], evidence: Evidence[]): string[] {
  const valid = new Set(evidence.map((e) => e.id));
  return [...new Set(citations.filter((c) => valid.has(c)))];
}

/**
 * Append freshly gathered evidence to the existing store, skipping duplicates
 * (by source URL + claim) and assigning new contiguous ids so the brief's
 * original ids stay stable.
 */
function mergeEvidence(existing: Evidence[], gathered: Evidence[]): Evidence[] {
  const seen = new Set(existing.map((e) => `${e.sourceUrl} ${e.claim}`));
  const out = [...existing];
  let n = existing.length;
  for (const g of gathered) {
    const key = `${g.sourceUrl} ${g.claim}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...g, id: `e${++n}` });
  }
  return out;
}
