import { Pool, type QueryResultRow } from "pg";

/**
 * The database — Supabase Postgres, spoken to directly with `pg` and SQL.
 *
 * There is no ORM here on purpose. The whole feature is five queries over one
 * table, which doesn't earn an ORM's dependency surface or its migration
 * tooling — and mirroring Better Auth's internal schema into a hand-maintained
 * schema file would drift silently the first time Better Auth added a column.
 * Better Auth generates its own DDL (`sql/0001_auth.sql`); we write ours.
 *
 * The pool is built **lazily**, on first use, for the same reason `lib/llm`
 * defers building its provider: `next build` — and CI — must succeed with no
 * `DATABASE_URL`. A module-level pool would make the connection string a
 * build-time requirement and break the quality gates on a fresh clone.
 *
 * `DATABASE_URL` has two forms. Point the app at Supabase's **transaction
 * pooler** (port 6543), which is what makes serverless connection counts
 * survivable; the **direct** connection (5432) is for applying the SQL files.
 */

let pool: Pool | null = null;

/** True when the app is configured to persist anything at all. Storage is
 *  optional: without a database ARGUS still runs, briefs just stay local. */
export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

/** The connection pool. Throws when unconfigured — callers gate on
 *  `isDatabaseConfigured()` and degrade rather than letting this surface. */
export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — brief storage is unavailable.");
  }

  // One connection per serverless instance: the pooler is what handles fan-out,
  // so a large local pool only holds slots this instance will never use.
  pool = new Pool({ connectionString, max: 1 });
  return pool;
}

/**
 * Run a parameterised query and return its rows.
 *
 * `T` is an assertion, not a proof — `pg` hands back whatever the database had.
 * For scalar columns that's fine; for the `result` blob the real guarantee is
 * the `briefResultSchema` parse in `lib/briefs/map.ts`, never this type.
 *
 * Always pass values through `params` (`$1`, `$2`, …). No query in this
 * codebase interpolates a value into SQL text.
 */
export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as unknown[]);
  return result.rows;
}
