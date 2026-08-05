import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_LIMITS,
  attachmentSchema,
  briefInputSchema,
  briefResultSchema,
} from "@/types/brief";

/**
 * The attachment/brief separation (#99), pinned as a test.
 *
 * Files are retained in object storage now, but they are still kept *out* of
 * the brief row, and that separation is enforced by the shape of the contract
 * rather than by discipline. `BriefResult.input` is what gets written to the
 * `brief` row and re-sent with every follow-up, and it is a `BriefInput` — so
 * as long as an attachment cannot survive a trip through `briefInputSchema`,
 * no code path can inline a file payload into a brief.
 *
 * Still load-bearing, for a slightly different reason than when it was written:
 * someone adding `attachments` to `briefInputSchema` for convenience would
 * duplicate every uploaded document into the database, into every follow-up
 * request, and into local browser history — none of which have a deletion path.
 * This is what stops them.
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
