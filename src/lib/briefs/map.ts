import { briefResultSchema, type BriefResult } from "@/types/brief";

/**
 * Pure mapping between a `BriefResult` and its `brief` row. Kept free of any
 * database or request handle so the round-trip — and, more importantly, the
 * behaviour on a row whose stored JSON has drifted from the current schema — is
 * testable offline, the way the rest of this repo's suite is.
 *
 * The stored `result` blob is re-validated on the way out for the same reason
 * `isHistoryEntry` guards localStorage in `lib/brief-history.ts`: persisted data
 * outlives the schema that wrote it, and a drifted row should drop out of a list
 * rather than take the page down with it. `pg` hands back whatever the database
 * holds, so this parse — not the row type below — is the real guarantee.
 */

/** A `brief` row as `pg` returns it. Mirrors `sql/0002_brief.sql`. */
export type BriefRow = {
  id: string;
  user_id: string;
  company: string;
  person: string;
  context: string;
  meeting_type: string | null;
  provider: string;
  model: string;
  elapsed_ms: number;
  demo: boolean;
  generated_at: string;
  /** Typed as `unknown` on purpose — it is untrusted until parsed. */
  result: unknown;
  created_at: Date;
};

/** The columns the library list selects — no evidence, no brief body.
 *  `evidence_count` is computed in SQL (`jsonb_array_length`) rather than by
 *  parsing the blob, so the list keeps its source count without shipping the
 *  evidence itself. */
export type BriefSummaryRow = Pick<
  BriefRow,
  "id" | "company" | "person" | "context" | "generated_at" | "demo"
> & { evidence_count: number };

/** A brief as the library list sees it. */
export type BriefSummary = {
  id: string;
  company: string;
  person: string;
  context: string;
  generatedAt: string;
  demo: boolean;
  evidenceCount: number;
};

/** The column values for an insert, in the order `repo.saveBrief` binds them.
 *  `id` is minted by the caller — a row id must be unique per database, and
 *  `generatedAt` is only unique per browser. */
export function toRow(id: string, userId: string, result: BriefResult) {
  return {
    id,
    user_id: userId,
    company: result.entity.company.name,
    person: result.entity.person.name,
    context: result.input.context,
    meeting_type: result.input.meetingType ?? null,
    provider: result.meta.provider,
    model: result.meta.model,
    elapsed_ms: result.meta.elapsedMs,
    demo: result.meta.demo === true,
    generated_at: result.meta.generatedAt,
    result,
  };
}

/** The stored `BriefResult`, or `null` when the row's JSON no longer parses
 *  against the current schema. */
export function fromRow(row: Pick<BriefRow, "result">): BriefResult | null {
  const parsed = briefResultSchema.safeParse(row.result);
  return parsed.success ? parsed.data : null;
}

/** The listing projection. Reads the mirrored columns, never the blob, so
 *  listing stays cheap and survives a drifted `result`. */
export function toSummary(row: BriefSummaryRow): BriefSummary {
  return {
    id: row.id,
    company: row.company,
    person: row.person,
    context: row.context,
    generatedAt: row.generated_at,
    demo: row.demo,
    evidenceCount: row.evidence_count,
  };
}
