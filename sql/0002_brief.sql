-- A saved brief, owned by a signed-in user.
--
-- The whole BriefResult lives in `result`: briefResultSchema (src/types/brief.ts)
-- is already the contract, and the entire object is needed to render a brief.
-- Normalising evidence and brief items into tables would buy nothing today and
-- would guarantee drift from that zod schema. The scalar columns beside it
-- mirror the fields the library list reads, so listing never parses JSON — and
-- they can be indexed and searched later.

create table "brief" (
  "id"           text primary key,
  "user_id"      text not null references "user" ("id") on delete cascade,

  -- Listable fields, mirrored from result.input / result.entity.
  "company"      text not null,
  "person"       text not null,
  "context"      text not null,
  "meeting_type" text,

  -- Run metadata, mirrored from result.meta.
  "provider"     text not null,
  "model"        text not null,
  "elapsed_ms"   integer not null,
  "demo"         boolean not null default false,
  "generated_at" text not null,

  -- The full BriefResult. Re-validated with briefResultSchema on read.
  "result"       jsonb not null,

  "created_at"   timestamptz not null default now()
);

-- The library list: one user's briefs, newest first.
create index "brief_user_created_idx" on "brief" ("user_id", "created_at" desc);

-- `id` is server-minted because a brief's generatedAt timestamp is unique per
-- browser, not per database. generated_at is still stored, and this constraint
-- is what makes claiming a browser's local history idempotent: a re-claim is an
-- `on conflict do nothing` rather than a duplicate row.
create unique index "brief_user_generated_at_idx" on "brief" ("user_id", "generated_at");
