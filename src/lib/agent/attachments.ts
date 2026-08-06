import { generateObject } from "ai";
import { z } from "zod";
import { getModel, llmDefaults, llmModelId } from "@/lib/llm";
import { withGeneration, withObservation } from "@/lib/telemetry";
import { ATTACHMENT_SCHEME } from "@/lib/evidence-source";
import { attachmentRef } from "@/lib/storage/attachment-ref";
import type { Attachment, Evidence, ResolvedEntity } from "@/types/brief";

/**
 * Attachment evidence (#99) — the one source the public tool belt can't reach.
 *
 * Reads a document the rep supplied and turns it into the same `Evidence` shape
 * every gather tool produces, so the claims it yields are cited, grounded and
 * answerable in follow-ups exactly like a filing or a job posting. The grounding
 * discipline is unchanged: a claim the document doesn't support gets dropped by
 * `groundClaim` downstream, same as any other.
 *
 * Two things make it a sibling of the tool belt rather than a member of it.
 * `GatherTool` routes on the resolved entity (`appliesTo`) and fetches over the
 * network; this routes on what the rep handed us and does its work in a model
 * call. So it runs *beside* `gather()` — concurrently, since neither waits on
 * the other — rather than inside it.
 *
 * Nothing here writes to disk. The base64 payload lives in the request's memory
 * for the length of one extraction call and is unreferenced the moment this
 * returns.
 */

/** Its own budget, sized to fit inside the gather window it runs alongside. */
const EXTRACT_TIMEOUT_MS = 20_000;

/** Per document. Enough for a real RFP; short of an unreadable Sources list. */
const MAX_CLAIMS = 8;

/** Textual attachments are inlined as prompt text; oversized ones are trimmed. */
const MAX_TEXT_CHARS = 40_000;

const modelClaimsSchema = z.object({
  claims: z.array(
    z.object({
      claim: z.string(),
      locator: z.string(),
    }),
  ),
});

const SYSTEM = `You read a document a B2B sales rep has supplied about a company they are meeting, and extract the factual claims worth putting in a pre-meeting brief.

Rules:
- Extract ONLY what the document itself states. Never add facts from your own knowledge, and never infer beyond what is written. If the document is thin, return few claims or none.
- Each claim must be one self-contained sentence a rep can read without the document in front of them. Name the subject explicitly rather than writing "they" or "the company".
- Prefer decision-useful specifics — requirements, budgets, timelines, incumbent vendors, stated priorities, constraints, named stakeholders, evaluation criteria. Skip boilerplate, legal footers, page furniture, contact blocks and marketing filler.
- \`locator\` is where in the document the claim came from, as a reader would cite it: "p. 4", "Section 3.2", "Requirements table". Use an empty string when the document has no usable structure.
- Do not extract the rep's own company's marketing material as if it were a fact about the buyer. If the document is entirely about the seller, return no claims.
- Return at most ${MAX_CLAIMS} claims, most decision-useful first. An empty array is a valid and honest answer.`;

/**
 * Extract evidence from every attachment, concurrently.
 *
 * Fail-soft per document, matching the tool belt's contract: one unreadable or
 * slow file yields no evidence rather than sinking the brief. `id` is left blank
 * here and assigned by `mergeEvidence` once this is folded in beside the gather
 * results, so citation ids stay contiguous.
 */
export async function extractAttachmentEvidence(
  attachments: Attachment[],
  entity: ResolvedEntity,
): Promise<Evidence[]> {
  if (attachments.length === 0) return [];

  return withObservation(
    "attachments",
    { count: attachments.length, company: entity.company.name },
    async () => {
      const settled = await Promise.allSettled(
        attachments.map((a) => readOne(a, entity)),
      );

      const evidence: Evidence[] = [];
      const failures: string[] = [];

      settled.forEach((result, i) => {
        if (result.status === "fulfilled") {
          evidence.push(...result.value);
        } else {
          // Filename only — never the document's contents.
          failures.push(`${attachments[i].name}: ${errorMessage(result.reason)}`);
        }
      });

      if (failures.length > 0) {
        console.warn("attachment errors —", failures.join("; "));
      }

      return evidence;
    },
    (result) => ({ evidenceCount: result.length }),
  );
}

async function readOne(
  attachment: Attachment,
  entity: ResolvedEntity,
): Promise<Evidence[]> {
  const { object } = await withGeneration(
    "extract-attachment",
    {
      model: llmModelId,
      // The document's own text is deliberately absent from the trace input —
      // an attachment is private to the rep, and observability isn't a reason
      // to copy it somewhere it outlives the request.
      input: { mediaType: attachment.mediaType, company: entity.company.name },
    },
    () =>
      generateObject({
        model: getModel(),
        schema: modelClaimsSchema,
        maxRetries: llmDefaults.maxRetries,
        abortSignal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  `The rep is meeting ${entity.person.name} at ${entity.company.name}.`,
                  `Document: ${attachment.name}`,
                  ``,
                  `Extract the claims about ${entity.company.name} this document supports.`,
                ].join("\n"),
              },
              documentPart(attachment),
            ],
          },
        ],
      }),
    (r) => ({ output: { claims: r.object.claims.length }, usage: r.usage }),
  );

  const retrievedAt = new Date().toISOString();
  const ref = attachmentRef(attachment);

  return object.claims
    .slice(0, MAX_CLAIMS)
    .map((c) => ({
      claim: c.claim.trim(),
      locator: c.locator.trim(),
    }))
    .filter((c) => c.claim.length > 0)
    .map((c) => ({
      id: "",
      claim: c.claim,
      sourceUrl: locatorUri(ref, c.locator),
      sourceTitle: c.locator
        ? `${attachment.name} — ${c.locator}`
        : attachment.name,
      tool: "attachment",
      retrievedAt,
    }));
}

/**
 * The document part of the prompt.
 *
 * Text formats are inlined directly: both providers handle them more reliably
 * as prompt text than as a binary part, and it avoids paying image-tokenisation
 * rates for what is already text. PDFs and images go through as file parts,
 * which both the Gemini and Anthropic providers accept natively.
 */
function documentPart(
  attachment: Attachment,
):
  | { type: "text"; text: string }
  | { type: "file"; data: string; mediaType: string; filename: string } {
  if (attachment.mediaType.startsWith("text/")) {
    const text = Buffer.from(attachment.data, "base64").toString("utf8");
    return {
      type: "text",
      text: `--- ${attachment.name} ---\n${text.slice(0, MAX_TEXT_CHARS)}`,
    };
  }
  return {
    type: "file",
    data: attachment.data,
    mediaType: attachment.mediaType,
    filename: attachment.name,
  };
}

/**
 * Build the evidence locator. Carries the `attachment:` scheme so the UI can
 * tell it from a public link (see `lib/evidence-source.ts`) and renders as a
 * plain chip rather than a dead anchor.
 */
function locatorUri(ref: string, locator: string): string {
  const base = `${ATTACHMENT_SCHEME}//${ref}`;
  return locator ? `${base}#${encodeURIComponent(locator)}` : base;
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}
