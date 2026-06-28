import type {
  AskResult,
  Brief,
  BriefItem,
  Evidence,
  GuidanceItem,
} from "@/types/brief";

/**
 * Grounding invariants (#76) — the machine-checkable form of ARGUS's core
 * promise. These run over a finished brief / answer (no LLM, deterministic) and
 * return every violation, so CI can fail the moment a change lets an uncited
 * claim, a fabricated anchor, or a leaked seller id slip into the output. The
 * enforcement lives in `grounding.ts`; these are the independent audit.
 */

export type Violation = { invariant: string; detail: string };

/** Seller-stated facts use `s`-ids and must NEVER appear as a public citation. */
const isSellerId = (id: string) => /^s\d+$/i.test(id);
/** A bracketed evidence/seller token left in prose, e.g. "[e1]" or "[s2, e3]". */
const inlineIdToken = /\[\s*[es]\d+/i;

/**
 * Invariant 1 — every sourced claim cites real buyer evidence, and never a
 * seller id. Sections: talkingPoints, riskAlerts, buyingSignals.
 */
export function checkClaimsGrounded(
  brief: Brief,
  evidence: Evidence[],
): Violation[] {
  const valid = new Set(evidence.map((e) => e.id));
  const out: Violation[] = [];
  const sections: [string, BriefItem[]][] = [
    ["talkingPoints", brief.talkingPoints],
    ["riskAlerts", brief.riskAlerts],
    ["buyingSignals", brief.buyingSignals],
  ];
  for (const [name, items] of sections) {
    for (const it of items) {
      if (it.citations.length === 0) {
        out.push({ invariant: "claim-cited", detail: `${name}: uncited claim "${it.text}"` });
      }
      for (const c of it.citations) {
        if (isSellerId(c)) {
          out.push({ invariant: "no-seller-id-in-citation", detail: `${name}: cites seller id ${c}` });
        } else if (!valid.has(c)) {
          out.push({ invariant: "citation-resolves", detail: `${name}: cites missing evidence ${c}` });
        }
      }
    }
  }
  return out;
}

/**
 * Invariant 2 — derived guidance never poses as a sourced fact: a
 * "sourced-premise" item must keep a resolvable anchor, anchors resolve to real
 * evidence, and a seller id never leaks in as an anchor.
 */
export function checkGuidanceGrounded(
  brief: Brief,
  evidence: Evidence[],
): Violation[] {
  const valid = new Set(evidence.map((e) => e.id));
  const out: Violation[] = [];
  const sections: [string, GuidanceItem[]][] = [
    ["decisionAsks", brief.decisionAsks],
    ["questions", brief.questions],
    ["fitHypotheses", brief.fitHypotheses],
  ];
  for (const [name, items] of sections) {
    for (const it of items) {
      for (const a of it.anchors) {
        if (isSellerId(a)) {
          out.push({ invariant: "no-seller-id-in-anchor", detail: `${name}: anchors seller id ${a}` });
        } else if (!valid.has(a)) {
          out.push({ invariant: "anchor-resolves", detail: `${name}: anchors missing evidence ${a}` });
        }
      }
      if (it.kind === "sourced-premise" && it.anchors.length === 0) {
        out.push({ invariant: "sourced-premise-anchored", detail: `${name}: sourced-premise with no anchor` });
      }
    }
  }
  return out;
}

/** Invariant 3 — the framing summary carries no smuggled-in inline id tokens. */
export function checkSummaryClean(brief: Brief): Violation[] {
  const out: Violation[] = [];
  if (inlineIdToken.test(brief.snapshot)) {
    out.push({ invariant: "summary-no-inline-ids", detail: "snapshot contains an inline id token" });
  }
  if (inlineIdToken.test(brief.objective)) {
    out.push({ invariant: "summary-no-inline-ids", detail: "objective contains an inline id token" });
  }
  return out;
}

/**
 * Invariant 4 — a follow-up answer is cited or honestly empty. A supported
 * answer resolves its citations (and never to a seller id); an unsupported
 * answer carries no citations or evidence at all.
 */
export function checkAnswerGrounded(ans: AskResult): Violation[] {
  const valid = new Set(ans.evidence.map((e) => e.id));
  const out: Violation[] = [];
  if (ans.supported) {
    if (ans.citations.length === 0) {
      out.push({ invariant: "answer-supported-cited", detail: "supported answer has no citations" });
    }
    for (const c of ans.citations) {
      if (isSellerId(c)) {
        out.push({ invariant: "no-seller-id-in-answer", detail: `answer cites seller id ${c}` });
      } else if (!valid.has(c)) {
        out.push({ invariant: "answer-citation-resolves", detail: `answer cites missing evidence ${c}` });
      }
    }
  } else if (ans.citations.length > 0 || ans.evidence.length > 0) {
    out.push({ invariant: "unsupported-answer-bare", detail: "unsupported answer still carries citations/evidence" });
  }
  return out;
}

/** All brief-level invariants in one pass. */
export function allBriefViolations(
  brief: Brief,
  evidence: Evidence[],
): Violation[] {
  return [
    ...checkClaimsGrounded(brief, evidence),
    ...checkGuidanceGrounded(brief, evidence),
    ...checkSummaryClean(brief),
  ];
}
