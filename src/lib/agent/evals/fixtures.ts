import type { AskResult, Brief, Evidence } from "@/types/brief";

/**
 * Golden fixtures (#76) — hand-authored, recorded-shape outputs that a correct
 * grounded pipeline produces. Deterministic and free (no LLM): they let CI
 * regression-test the invariants across the cases that matter — a public company
 * with seller-tailored fit, a private company from job-board signal, and a
 * thin-evidence brief that degrades honestly. Every fixture must satisfy every
 * invariant in `invariants.ts`.
 */

export type BriefFixture = {
  name: string;
  evidence: Evidence[];
  brief: Brief;
};

const AT = "2026-06-28T00:00:00.000Z";

// ── Public company, seller provided → tailored fit hypotheses ─────────────
const publicCo: BriefFixture = {
  name: "public-company-with-seller-fit",
  evidence: [
    { id: "e1", claim: "Reported 28% YoY revenue growth in its latest quarterly results.", sourceUrl: "https://example.com/vayu/q4-results", sourceTitle: "Vayu Analytics — quarterly results", tool: "financials", retrievedAt: AT },
    { id: "e2", claim: "Opened 14 backend/data-platform roles this quarter.", sourceUrl: "https://boards.greenhouse.io/vayuanalytics", sourceTitle: "Vayu Analytics careers", tool: "jobboards", retrievedAt: AT },
    { id: "e3", claim: "Recent press notes a push into self-serve analytics.", sourceUrl: "https://news.example.com/vayu-analytics", sourceTitle: "Vayu Analytics self-serve push", tool: "gdelt", retrievedAt: AT },
  ],
  brief: {
    snapshot: "Vayu Analytics — enterprise analytics platform.",
    objective: "Expansion conversation around their analytics roadmap.",
    talkingPoints: [
      { text: "Their 28% YoY growth signals budget for new tooling.", citations: ["e1"] },
      { text: "A 14-role data-platform hiring spike points to scaling pains.", citations: ["e2"] },
    ],
    riskAlerts: [],
    buyingSignals: [{ text: "Public push into self-serve analytics aligns with a buy.", citations: ["e3"] }],
    decisionAsks: [
      { text: "Ask for a scoped pilot with the data-platform team.", anchors: ["e2"], kind: "sourced-premise" },
    ],
    questions: [
      { text: "How is the 14-role hiring tied to your data-infra roadmap?", anchors: ["e2"], kind: "sourced-premise" },
      { text: "Who owns the analytics budget for next year?", anchors: [], kind: "strategic" },
    ],
    fitHypotheses: [
      { text: "Your offering could absorb their self-serve analytics push without new headcount.", anchors: ["e3"], kind: "sourced-premise" },
    ],
  },
};

// ── Private company, job-board signal, no seller ──────────────────────────
const privateCo: BriefFixture = {
  name: "private-company-jobboard-signal",
  evidence: [
    { id: "e1", claim: "Posted 6 senior SRE roles in the last 30 days.", sourceUrl: "https://jobs.lever.co/nirvaanlabs", sourceTitle: "Nirvaan Labs jobs", tool: "jobboards", retrievedAt: AT },
  ],
  brief: {
    snapshot: "Nirvaan Labs — private infrastructure startup.",
    objective: "Discovery call on their reliability tooling needs.",
    talkingPoints: [{ text: "Six new SRE openings suggest reliability is a current priority.", citations: ["e1"] }],
    riskAlerts: [],
    buyingSignals: [{ text: "SRE hiring spike is a buying signal for ops tooling.", citations: ["e1"] }],
    decisionAsks: [],
    questions: [
      { text: "What's driving the SRE expansion right now?", anchors: ["e1"], kind: "sourced-premise" },
    ],
    fitHypotheses: [],
  },
};

// ── Thin evidence → honest, sparse brief ──────────────────────────────────
const thin: BriefFixture = {
  name: "thin-evidence-degrades",
  evidence: [],
  brief: {
    snapshot: "Bharat Industries — industrials.",
    objective: "Intro meeting.",
    talkingPoints: [],
    riskAlerts: [],
    buyingSignals: [],
    decisionAsks: [],
    questions: [],
    fitHypotheses: [],
  },
};

export const briefFixtures: BriefFixture[] = [publicCo, privateCo, thin];

// ── Follow-up answers ─────────────────────────────────────────────────────

export const supportedAnswer: AskResult = {
  question: "What changed since their last earnings?",
  answer: "They reported 28% YoY revenue growth in their latest quarterly results, with new analytics investment.",
  citations: ["e1"],
  supported: true,
  evidence: [publicCo.evidence[0]],
  meta: { generatedAt: AT, provider: "gemini", model: "gemini-2.5-flash", elapsedMs: 1200 },
};

export const unsupportedAnswer: AskResult = {
  question: "What is their CEO's compensation?",
  answer: "There's no public signal on that in the gathered sources yet.",
  citations: [],
  supported: false,
  evidence: [],
  meta: { generatedAt: AT, provider: "gemini", model: "gemini-2.5-flash", elapsedMs: 800 },
};
