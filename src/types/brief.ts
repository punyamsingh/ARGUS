import { z } from "zod";

/**
 * Core data contracts for the ARGUS pipeline — zod schemas are the single
 * source of truth; TS types are inferred from them. The same schemas are
 * consumed directly by the Vercel AI SDK's `generateObject` in synthesis (#6),
 * so "no source → not in the brief" is structurally enforced.
 *
 * Flow: BriefInput → ResolvedEntity (#4) → Evidence[] (#5) → Brief (#6)
 */

// ── Input ────────────────────────────────────────────────────

export const briefInputSchema = z.object({
  company: z.string().trim().min(1, "Company is required"),
  person: z.string().trim().min(1, "Who you're meeting is required"),
  context: z.string().trim().min(1, "Meeting context is required"),
});
export type BriefInput = z.infer<typeof briefInputSchema>;

// ── Entity resolution output (#4) ────────────────────────────
// Carries the identifiers each gather tool needs to fire.

export const entityCandidateSchema = z.object({
  name: z.string(),
  domain: z.string().optional(),
  reason: z.string().optional(),
});
export type EntityCandidate = z.infer<typeof entityCandidateSchema>;

export const resolvedCompanySchema = z.object({
  name: z.string(),
  domain: z.string().optional(), // website fetch
  industry: z.string().optional(),
  isPublic: z.boolean().default(false),
  ticker: z.string().optional(), // financial markets
  cik: z.string().optional(), // SEC EDGAR
  jobBoardSlug: z.string().optional(), // Greenhouse / Lever
});
export type ResolvedCompany = z.infer<typeof resolvedCompanySchema>;

export const resolvedPersonSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
});
export type ResolvedPerson = z.infer<typeof resolvedPersonSchema>;

export const resolvedEntitySchema = z.object({
  company: resolvedCompanySchema,
  person: resolvedPersonSchema,
  confidence: z.number().min(0).max(1),
  candidates: z.array(entityCandidateSchema).default([]),
});
export type ResolvedEntity = z.infer<typeof resolvedEntitySchema>;

// ── Evidence (#5 + tool belt) ────────────────────────────────
// Produced by gather tools, never by the model. Every brief claim cites these.

export const evidenceSchema = z.object({
  /** Stable id used by brief citations, e.g. "e1". */
  id: z.string(),
  claim: z.string(),
  sourceUrl: z.string().url(),
  sourceTitle: z.string(),
  /** Which gather tool produced this (e.g. "wikipedia", "edgar"). */
  tool: z.string(),
  /** ISO 8601 retrieval timestamp. */
  retrievedAt: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

// ── Brief (#6, generated via generateObject) ─────────────────
// Each item must cite ≥1 evidence id → grounding is enforced at the type level.
// Synthesis (#6) drops any item whose citations don't resolve to real evidence.

export const briefItemSchema = z.object({
  text: z.string(),
  /** Evidence ids backing this item. At least one — no source, no item. */
  citations: z.array(z.string()).min(1),
});
export type BriefItem = z.infer<typeof briefItemSchema>;

export const briefSchema = z.object({
  /** One-line who/what framing. */
  snapshot: z.string(),
  /** The inferred meeting objective. */
  objective: z.string(),
  talkingPoints: z.array(briefItemSchema),
  decisionAsks: z.array(briefItemSchema),
  riskAlerts: z.array(briefItemSchema),
  buyingSignals: z.array(briefItemSchema),
});
export type Brief = z.infer<typeof briefSchema>;

// ── End-to-end result (the /api/brief contract, #7) ──────────

export const briefMetaSchema = z.object({
  generatedAt: z.string(),
  provider: z.string(),
  model: z.string(),
  elapsedMs: z.number(),
});
export type BriefMeta = z.infer<typeof briefMetaSchema>;

export const briefResultSchema = z.object({
  input: briefInputSchema,
  entity: resolvedEntitySchema,
  evidence: z.array(evidenceSchema),
  brief: briefSchema,
  meta: briefMetaSchema,
});
export type BriefResult = z.infer<typeof briefResultSchema>;
