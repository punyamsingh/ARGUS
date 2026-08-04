import { describe, expect, it } from "vitest";
import { briefResultSchema, type BriefResult } from "@/types/brief";
import { fromRow, toRow, toSummary } from "./map";

/**
 * Offline unit tests for the row mapping — no database, in keeping with the rest
 * of the suite ("deterministic and offline, so it's safe to gate CI").
 *
 * The case that matters most is the last one: a stored blob that no longer
 * matches the schema must degrade to `null`, not throw. Persisted briefs outlive
 * the schema that wrote them, and a drifted row should drop out of a view rather
 * than take the page down.
 */

function makeResult(overrides: Partial<BriefResult["meta"]> = {}): BriefResult {
  return {
    input: {
      company: "Acme",
      person: "Jane Smith",
      context: "renewal call",
      meetingType: "renewal",
    },
    entity: {
      company: { name: "Acme Corp", isPublic: false },
      person: { name: "Jane Smith", role: "VP Engineering" },
      confidence: 0.9,
      candidates: [],
    },
    evidence: [
      {
        id: "e1",
        claim: "Acme raised a Series B.",
        sourceUrl: "https://example.com/news",
        sourceTitle: "Example News",
        tool: "wikipedia",
        retrievedAt: "2026-08-04T00:00:00.000Z",
      },
    ],
    brief: {
      snapshot: "Acme Corp, a private company.",
      objective: "Renew the contract.",
      talkingPoints: [{ text: "They raised a Series B.", citations: ["e1"] }],
      riskAlerts: [],
      buyingSignals: [],
      decisionAsks: [
        { text: "Ask for a two-year term.", anchors: [], kind: "strategic" },
      ],
      questions: [],
      fitHypotheses: [],
    },
    meta: {
      generatedAt: "2026-08-04T10:00:00.000Z",
      provider: "gemini",
      model: "gemini-2.5-flash",
      elapsedMs: 1234,
      ...overrides,
    },
  };
}

describe("toRow", () => {
  it("mirrors the listable fields out of the result", () => {
    const row = toRow("id-1", "user-1", makeResult());

    // Company and person come from the *resolved* entity, not the raw input —
    // "Acme" in, "Acme Corp" on the row.
    expect(row.company).toBe("Acme Corp");
    expect(row.person).toBe("Jane Smith");
    expect(row.context).toBe("renewal call");
    expect(row.meeting_type).toBe("renewal");
    expect(row.generated_at).toBe("2026-08-04T10:00:00.000Z");
    expect(row.elapsed_ms).toBe(1234);
  });

  it("defaults demo to false and meeting type to null when absent", () => {
    const result = makeResult();
    delete result.input.meetingType;
    const row = toRow("id-1", "user-1", result);

    expect(row.meeting_type).toBeNull();
    expect(row.demo).toBe(false);
  });

  it("marks a demo brief", () => {
    const row = toRow("id-1", "user-1", makeResult({ demo: true }));
    expect(row.demo).toBe(true);
  });
});

describe("fromRow", () => {
  it("round-trips a result through the row and back", () => {
    const original = makeResult();
    const restored = fromRow({ result: toRow("id-1", "user-1", original).result });

    expect(restored).not.toBeNull();
    expect(briefResultSchema.safeParse(restored).success).toBe(true);
    expect(restored).toEqual(original);
  });

  it("returns null for a blob that has drifted from the schema", () => {
    expect(fromRow({ result: { nonsense: true } })).toBeNull();
    expect(fromRow({ result: null })).toBeNull();
    expect(fromRow({ result: "not an object" })).toBeNull();
  });

  it("returns null when a required section is missing", () => {
    const partial = makeResult() as Partial<BriefResult>;
    delete partial.evidence;
    expect(fromRow({ result: partial })).toBeNull();
  });
});

describe("toSummary", () => {
  it("projects the list view without touching the blob", () => {
    expect(
      toSummary({
        id: "id-1",
        company: "Acme Corp",
        person: "Jane Smith",
        context: "renewal call",
        generated_at: "2026-08-04T10:00:00.000Z",
        demo: false,
        evidence_count: 3,
      }),
    ).toEqual({
      id: "id-1",
      company: "Acme Corp",
      person: "Jane Smith",
      context: "renewal call",
      generatedAt: "2026-08-04T10:00:00.000Z",
      demo: false,
      evidenceCount: 3,
    });
  });
});
