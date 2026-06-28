import type { BriefItem, Evidence, GuidanceItem } from "@/types/brief";

/**
 * The grounding primitives — the enforcement points that make ARGUS's "no source
 * → not in the brief" promise real. Kept dependency-light (types only, no LLM /
 * telemetry imports) so the eval harness (#76) can exercise the invariants in
 * isolation: whatever the model emits, these functions are what guarantee a
 * claim cites real evidence and guidance never poses as a sourced fact.
 */

/**
 * Remove inline evidence-id tokens the model writes into prose — `[e1]`,
 * `[e1, e3, e4]`, or runs like `[e1][e3]` (and stray seller `[s1]`) — then tidy
 * the leftover whitespace and dangling punctuation so the sentence reads cleanly.
 */
export function stripInlineCitations(text: string): string {
  return text
    .replace(/\s*\[\s*[es]\d+(?:\s*,\s*[es]\d+)*\s*\]/gi, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
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
 * answers). Unlike a claim, guidance is kept even with no anchors, but its
 * `anchors` are filtered to real ids (never fabricated) and a "sourced-premise"
 * item whose anchors don't resolve is downgraded to "strategic" so it is never
 * presented as resting on a citation it lacks.
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

/** Keep only citations that resolve to real evidence, de-duplicated. */
export function groundCitations(
  citations: string[],
  evidence: Evidence[],
): string[] {
  const valid = new Set(evidence.map((e) => e.id));
  return [...new Set(citations.filter((c) => valid.has(c)))];
}

/**
 * Append freshly gathered evidence to the existing store, skipping duplicates
 * (by source URL + claim) and assigning new contiguous ids so the brief's
 * original ids stay stable.
 */
export function mergeEvidence(
  existing: Evidence[],
  gathered: Evidence[],
): Evidence[] {
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
