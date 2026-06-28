import { describe, expect, it } from "vitest";
import {
  groundCitations,
  groundClaim,
  groundGuidance,
  mergeEvidence,
  stripInlineCitations,
} from "@/lib/agent/grounding";
import type { Evidence, GuidanceItem } from "@/types/brief";
import {
  allBriefViolations,
  checkAnswerGrounded,
} from "./invariants";
import {
  briefFixtures,
  supportedAnswer,
  unsupportedAnswer,
} from "./fixtures";

const ev = (id: string): Evidence => ({
  id,
  claim: `claim ${id}`,
  sourceUrl: `https://example.com/${id}`,
  sourceTitle: `Source ${id}`,
  tool: "test",
  retrievedAt: "2026-06-28T00:00:00.000Z",
});

describe("golden fixtures satisfy every grounding invariant", () => {
  for (const fx of briefFixtures) {
    it(fx.name, () => {
      expect(allBriefViolations(fx.brief, fx.evidence)).toEqual([]);
    });
  }

  it("supported answer is well-grounded; unsupported answer is bare", () => {
    expect(checkAnswerGrounded(supportedAnswer)).toEqual([]);
    expect(checkAnswerGrounded(unsupportedAnswer)).toEqual([]);
  });
});

describe("the invariant checkers actually catch violations", () => {
  it("flags an uncited / unresolved / seller-leaking claim", () => {
    const brief = {
      ...briefFixtures[0].brief,
      talkingPoints: [
        { text: "fabricated", citations: ["e999"] },
        { text: "leaks seller", citations: ["s1"] },
      ],
    };
    const names = allBriefViolations(brief, briefFixtures[0].evidence).map(
      (v) => v.invariant,
    );
    expect(names).toContain("citation-resolves");
    expect(names).toContain("no-seller-id-in-citation");
  });

  it("flags a supported answer that cites missing evidence", () => {
    const v = checkAnswerGrounded({
      ...supportedAnswer,
      citations: ["e1", "e9"],
    });
    expect(v.map((x) => x.invariant)).toContain("answer-citation-resolves");
  });
});

describe("grounding.ts enforces the invariants on adversarial model output", () => {
  const valid = new Set(["e1", "e2"]);

  it("groundClaim drops unresolved citations, unsupported items, and inline ids", () => {
    const out = groundClaim(
      [
        { text: "kept [e1]", citations: ["e1", "e9"] }, // e9 dropped, prose cleaned
        { text: "dropped", citations: ["e9"] }, // no valid citation → removed
        { text: "leaks", citations: ["s1"] }, // seller id not valid → removed
      ],
      valid,
    );
    expect(out).toEqual([{ text: "kept", citations: ["e1"] }]);
  });

  it("groundGuidance downgrades an unbacked sourced-premise to strategic", () => {
    const input: GuidanceItem[] = [
      { text: "premise [e1]", anchors: ["e1", "e9"], kind: "sourced-premise" },
      { text: "no support", anchors: ["e9"], kind: "sourced-premise" },
      { text: "strategic", anchors: [], kind: "strategic" },
    ];
    const out = groundGuidance(input, valid);
    expect(out).toEqual([
      { text: "premise", anchors: ["e1"], kind: "sourced-premise" },
      { text: "no support", anchors: [], kind: "strategic" },
      { text: "strategic", anchors: [], kind: "strategic" },
    ]);
    // And the result passes the guidance invariant.
    expect(
      allBriefViolations(
        { ...briefFixtures[2].brief, questions: out },
        [ev("e1"), ev("e2")],
      ),
    ).toEqual([]);
  });

  it("groundCitations filters to real ids and de-duplicates", () => {
    expect(groundCitations(["e1", "e1", "e9", "s1"], [ev("e1")])).toEqual(["e1"]);
  });

  it("mergeEvidence keeps existing ids stable and de-dupes by url+claim", () => {
    const existing = [ev("e1"), ev("e2")];
    const gathered: Evidence[] = [
      { ...ev("x"), id: "e1", sourceUrl: existing[0].sourceUrl, claim: existing[0].claim }, // dup
      { ...ev("new"), id: "e1" }, // genuinely new → re-id to e3
    ];
    const merged = mergeEvidence(existing, gathered);
    expect(merged.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    expect(merged[0].id).toBe("e1"); // existing unchanged
  });

  it("stripInlineCitations removes e- and s- tokens and tidies punctuation", () => {
    expect(stripInlineCitations("Growth is strong [e1, e3] .")).toBe(
      "Growth is strong.",
    );
    expect(stripInlineCitations("Our product [s1] fits [e2].")).toBe(
      "Our product fits.",
    );
  });
});
