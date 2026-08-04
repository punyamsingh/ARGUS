import { randomUUID } from "node:crypto";
import { query } from "@/db";
import type { BriefResult } from "@/types/brief";
import {
  fromRow,
  toRow,
  toSummary,
  type BriefRow,
  type BriefSummary,
  type BriefSummaryRow,
} from "./map";

/**
 * Every SQL statement in the application lives here.
 *
 * Two rules hold throughout, and both are load-bearing:
 *
 *  1. **`userId` is the first argument of every function**, and it always comes
 *     from the server-side session — never from a request body or a path. A
 *     brief is only ever reachable through its owner's id, so there is no code
 *     path where forgetting an ownership check is possible.
 *  2. **Every value is bound (`$1`, `$2`, …).** No statement interpolates a
 *     value into SQL text.
 *
 * Reads of the `result` blob go through `fromRow`, which re-validates against
 * `briefResultSchema`. A row whose stored JSON has drifted disappears from a
 * list rather than throwing.
 */

/** How many briefs a library page returns. Generous — nobody has 50 meetings
 *  queued — but bounded so a long-lived account can't return unbounded JSON. */
const LIST_LIMIT = 50;

// The source count is computed in SQL so the list can show "N src" without
// shipping the evidence array to the client.
const SUMMARY_COLUMNS = `id, company, person, context, generated_at, demo,
       coalesce(jsonb_array_length(result -> 'evidence'), 0) as evidence_count`;

/** A user's briefs, newest first. Reads only the mirrored columns, so listing
 *  never parses the blob. */
export async function listBriefs(userId: string): Promise<BriefSummary[]> {
  const rows = await query<BriefSummaryRow>(
    `select ${SUMMARY_COLUMNS}
       from brief
      where user_id = $1
      order by created_at desc
      limit $2`,
    [userId, LIST_LIMIT],
  );
  return rows.map(toSummary);
}

/** One brief, scoped to its owner. `null` covers "no such brief", "not yours",
 *  and "stored JSON no longer parses" alike — callers turn all three into a 404,
 *  so a probe can't distinguish someone else's id from a missing one. */
export async function getBrief(
  userId: string,
  id: string,
): Promise<BriefResult | null> {
  const rows = await query<Pick<BriefRow, "result">>(
    `select result from brief where user_id = $1 and id = $2`,
    [userId, id],
  );
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Persist a brief and return its server-minted id.
 *
 * Idempotent per `(user_id, generated_at)`: re-saving a brief the user already
 * has returns the existing id rather than duplicating it. That matters because
 * the client writes through on every successful generation *and* the claim path
 * may push the same brief from localStorage.
 */
export async function saveBrief(
  userId: string,
  result: BriefResult,
): Promise<string> {
  const row = toRow(randomUUID(), userId, result);

  const rows = await query<{ id: string }>(
    `insert into brief (
       id, user_id, company, person, context, meeting_type,
       provider, model, elapsed_ms, demo, generated_at, result
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (user_id, generated_at) do nothing
     returning id`,
    [
      row.id,
      row.user_id,
      row.company,
      row.person,
      row.context,
      row.meeting_type,
      row.provider,
      row.model,
      row.elapsed_ms,
      row.demo,
      row.generated_at,
      row.result,
    ],
  );

  if (rows[0]) return rows[0].id;

  // The conflict path: the row already exists, so return the id it already has.
  const existing = await query<{ id: string }>(
    `select id from brief where user_id = $1 and generated_at = $2`,
    [userId, row.generated_at],
  );
  return existing[0]?.id ?? row.id;
}

/** Delete a brief. Returns whether a row was actually removed, so a caller can
 *  answer 404 for someone else's id instead of a misleading success. */
export async function deleteBrief(userId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `delete from brief where user_id = $1 and id = $2 returning id`,
    [userId, id],
  );
  return rows.length > 0;
}

/**
 * Adopt a browser's local history into an account, once.
 *
 * Runs on first sign-in so the briefs someone generated before making an account
 * don't silently vanish. The unique index on `(user_id, generated_at)` does the
 * real work — a double-fire, a re-signin, or two tabs racing all collapse to the
 * same rows. Returns how many were newly adopted.
 */
export async function claimBriefs(
  userId: string,
  results: readonly BriefResult[],
): Promise<number> {
  let claimed = 0;
  // Sequential rather than one multi-row insert: the volume is tiny (localStorage
  // holds at most 6) and a single malformed entry shouldn't sink the whole claim.
  for (const result of results) {
    const before = await query<{ id: string }>(
      `select id from brief where user_id = $1 and generated_at = $2`,
      [userId, result.meta.generatedAt],
    );
    if (before.length > 0) continue;
    await saveBrief(userId, result);
    claimed += 1;
  }
  return claimed;
}
