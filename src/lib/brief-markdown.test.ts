import { describe, expect, it } from "vitest";
import { briefToMarkdown } from "@/lib/brief-markdown";
import { ATTACHMENT_SCHEME } from "@/lib/evidence-source";
import type { BriefResult, Evidence } from "@/types/brief";

/**
 * An exported brief travels further than the app does — into an email, a doc,
 * a CRM note. A public source has to stay a working link there; an attachment,
 * which only its owner can open, must not arrive looking like one (#99).
 */

const publicSource: Evidence = {
  id: "e1",
  claim: "Opened 14 data-platform roles this quarter.",
  sourceUrl: "https://boards.greenhouse.io/acme",
  sourceTitle: "Acme careers",
  tool: "jobboards",
  retrievedAt: "2026-08-05T00:00:00.000Z",
};

const attachedSource: Evidence = {
  id: "e2",
  claim: "Requires SSO and audit logging before rollout.",
  sourceUrl: `${ATTACHMENT_SCHEME}//a1b2c3d4e5f6#p.%204`,
  sourceTitle: "acme-rfp.pdf — p. 4",
  tool: "attachment",
  retrievedAt: "2026-08-05T00:00:00.000Z",
};

const result: BriefResult = {
  input: {
    company: "Acme",
    person: "Priya Sharma",
    context: "renewal call",
  },
  entity: {
    company: { name: "Acme", isPublic: false },
    person: { name: "Priya Sharma" },
    confidence: 0.9,
    candidates: [],
  },
  evidence: [publicSource, attachedSource],
  brief: {
    snapshot: "Acme — logistics software",
    objective: "Land the renewal",
    talkingPoints: [
      { text: "They're hiring hard on data platform.", citations: ["e1"] },
      { text: "SSO is a stated gate for rollout.", citations: ["e2"] },
    ],
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
    elapsedMs: 1234,
  },
};

describe("markdown export distinguishes attachments from public sources", () => {
  const md = briefToMarkdown(result);

  it("keeps public sources as working links", () => {
    // URLs are angle-bracketed by `escapeMdUrl` so parentheses can't break out.
    expect(md).toContain("[Acme careers](<https://boards.greenhouse.io/acme>)");
  });

  it("never emits an attachment locator as a link", () => {
    expect(md).not.toContain("](attachment:");
    expect(md).not.toContain(ATTACHMENT_SCHEME);
  });

  it("names the attachment and marks it as one", () => {
    expect(md).toContain("acme-rfp.pdf — p. 4 (attached document)");
  });

  it("still numbers both sources so every citation resolves", () => {
    expect(md).toContain("1. [Acme careers]");
    expect(md).toContain("2. acme-rfp.pdf");
  });
});
