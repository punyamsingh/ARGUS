import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_LIMITS,
  attachmentSchema,
  briefInputSchema,
  briefResultSchema,
} from "@/types/brief";

/**
 * The attachment retention guarantee (#99), pinned as a test.
 *
 * "Attachments are never stored" is not enforced by a delete step — it is
 * enforced by the shape of the contract. `BriefResult.input` is what gets
 * written to the `brief` row and re-sent with every follow-up, and it is a
 * `BriefInput`. So as long as an attachment cannot survive a trip through
 * `briefInputSchema`, there is no code path that can persist one.
 *
 * That makes this a load-bearing test rather than a pedantic one: someone
 * adding `attachments` to `briefInputSchema` for convenience would quietly
 * turn a privacy property into a bug, and this is what stops them.
 */

const input = {
  company: "Acme",
  person: "Priya Sharma",
  context: "renewal call",
};

const attachment = {
  name: "acme-rfp.pdf",
  mediaType: "application/pdf",
  data: "SGVsbG8=",
};

describe("attachments cannot reach anything that persists", () => {
  it("strips attachments smuggled into a brief input", () => {
    const parsed = briefInputSchema.parse({ ...input, attachments: [attachment] });
    expect(parsed).not.toHaveProperty("attachments");
  });

  it("strips them from a full brief result too", () => {
    const parsed = briefResultSchema.parse({
      input: { ...input, attachments: [attachment] },
      entity: {
        company: { name: "Acme", isPublic: false },
        person: { name: "Priya Sharma" },
        confidence: 0.9,
        candidates: [],
      },
      evidence: [],
      brief: {
        snapshot: "Acme",
        objective: "Land the renewal",
        talkingPoints: [],
        riskAlerts: [],
        buyingSignals: [],
        decisionAsks: [],
        questions: [],
        fitHypotheses: [],
      },
      meta: {
        generatedAt: "2026-08-05T00:00:00.000Z",
        provider: "gemini",
        model: "gemini-2.5-flash",
        elapsedMs: 1000,
      },
    });

    expect(parsed.input).not.toHaveProperty("attachments");
    expect(JSON.stringify(parsed)).not.toContain("acme-rfp.pdf");
  });
});

describe("the attachment contract itself", () => {
  it("accepts the supported document types", () => {
    expect(attachmentSchema.safeParse(attachment).success).toBe(true);
    expect(
      attachmentSchema.safeParse({ ...attachment, mediaType: "image/png" }).success,
    ).toBe(true);
  });

  it("rejects file types we can't read", () => {
    for (const mediaType of [
      "application/zip",
      "application/vnd.ms-excel",
      "text/html",
      "",
    ]) {
      expect(attachmentSchema.safeParse({ ...attachment, mediaType }).success).toBe(
        false,
      );
    }
  });

  it("keeps the wire caps under Vercel's request-body ceiling", () => {
    // base64 inflates by a third; the platform limit is ~4.5MB.
    const onTheWire = ATTACHMENT_LIMITS.maxTotalBytes * (4 / 3);
    expect(onTheWire).toBeLessThan(4_500_000);
    expect(ATTACHMENT_LIMITS.maxBytes).toBeLessThanOrEqual(
      ATTACHMENT_LIMITS.maxTotalBytes,
    );
  });
});
