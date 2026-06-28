import { generateObject } from "ai";
import { getModel, llmDefaults, llmModelId } from "@/lib/llm";
import { withGeneration } from "@/lib/telemetry";
import {
  resolvedEntitySchema,
  type BriefInput,
  type ResolvedEntity,
} from "@/types/brief";

/**
 * Entity resolution (#4) — the keystone that unblocks the tool belt.
 *
 * "Meeting Jane Smith at Acme" → which Jane, which Acme. Produces a
 * `ResolvedEntity` carrying the identifiers later tools need (domain, ticker,
 * isPublic, role) plus a confidence score and ambiguity candidates.
 *
 * Grounding note: this uses the model's own knowledge for a fast first pass.
 * Recency/verification is the gather layer's job (Wikipedia #24, Google Search
 * grounding #5), and `cik` / `jobBoardSlug` are resolved by their own tools
 * (EDGAR #27, job boards #26) from the domain/ticker we provide here.
 */

const SYSTEM = `You are the entity-resolution step of a B2B sales pre-meeting brief tool.
Given a company, a person, and meeting context, identify the most likely real-world entities.

Resolve only what you are reasonably confident about — never invent facts:
- company.name: the canonical company name
- company.domain: official website domain (e.g. "stripe.com") — omit if unsure
- company.industry: a short industry label
- company.isPublic: true only for companies you are confident are publicly listed
- company.ticker: stock ticker ONLY when isPublic and you are confident — otherwise omit
- person.name and person.role: the person and their likely title/role
- confidence: 0..1 — your overall confidence in this resolution
- candidates: if the company name is ambiguous (several real companies share it), list the plausible ones with a one-line reason; otherwise leave empty

Rules:
- Do NOT fabricate a domain or ticker. When unsure, omit the field.
- Leave cik and jobBoardSlug unset — downstream tools resolve those.
- If you don't recognise the company, return low confidence and any candidates you can think of.`;

export async function resolveEntity(input: BriefInput): Promise<ResolvedEntity> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const result = await withGeneration(
      "resolve-entity",
      {
        model: llmModelId,
        input: {
          company: input.company,
          person: input.person,
          context: input.context,
        },
      },
      () =>
        generateObject({
          model: getModel(),
          schema: resolvedEntitySchema,
          maxRetries: llmDefaults.maxRetries,
          abortSignal: controller.signal,
          system: SYSTEM,
          prompt: [
            `Company: ${input.company}`,
            `Person: ${input.person}`,
            `Meeting context: ${input.context}`,
          ].join("\n"),
        }),
      (r) => ({ output: r.object, usage: r.usage }),
    );

    return result.object;
  } finally {
    clearTimeout(timeout);
  }
}
