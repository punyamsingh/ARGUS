// @ts-check
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";

/**
 * Regenerates `sql/0001_auth.sql` — the DDL for Better Auth's four core tables
 * (`user`, `session`, `account`, `verification`).
 *
 * Why a script rather than `@better-auth/cli generate`: the published CLI lags
 * the library (1.4.x against our 1.6.x), so it would emit a schema for a version
 * we don't run. `getMigrations` ships *inside* the installed `better-auth`, so
 * whatever it compiles is correct for the exact version in the lockfile.
 *
 * Why generate at all, rather than commit hand-written DDL: a hand-maintained
 * copy of someone else's schema drifts silently the first time they add a
 * column, and the failure shows up as broken auth in production rather than a
 * red build. Re-run this on every Better Auth upgrade and commit the diff.
 *
 *   DATABASE_URL=postgresql://... node scripts/generate-auth-sql.mjs
 *
 * It needs a reachable database because it diffs against the live schema to
 * decide what's missing. Point it at an EMPTY one — otherwise it emits only the
 * delta, not the full DDL. A throwaway local Postgres is the intended target;
 * nothing is written to the database, only read.
 */

const OUT = "sql/0001_auth.sql";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required — point it at an empty database.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

try {
  const { compileMigrations, toBeCreated } = await getMigrations({
    database: pool,
  });

  if (toBeCreated.length === 0) {
    console.error(
      "Nothing to create — the target database already has the auth tables.\n" +
        "Run this against an empty database or you'll get an empty file.",
    );
    process.exit(1);
  }

  const sql = await compileMigrations();
  const header = [
    "-- Better Auth core tables. GENERATED — do not edit by hand.",
    "-- Regenerate with: DATABASE_URL=... node scripts/generate-auth-sql.mjs",
    "-- Source of truth is the installed better-auth version; re-run on upgrade.",
    "",
  ].join("\n");

  await writeFile(OUT, `${header}${sql.trim()}\n`);
  console.log(`Wrote ${OUT} (${toBeCreated.map((t) => t.table).join(", ")})`);
} finally {
  await pool.end();
}
