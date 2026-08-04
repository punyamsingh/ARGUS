<div align="center">

# ARGUS

**A**gentic **R**esearch **G**enerated to **U**nburden **S**alespeople.

AI **pre-meeting intelligence** for B2B sales reps — 45 minutes of scattered
account research, distilled into one **cited**, conversation-ready brief.

[![CI](https://github.com/punyamsingh/ARGUS/actions/workflows/ci.yml/badge.svg)](https://github.com/punyamsingh/ARGUS/actions/workflows/ci.yml)
[![Release](https://github.com/punyamsingh/ARGUS/actions/workflows/release.yml/badge.svg)](https://github.com/punyamsingh/ARGUS/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node 24](https://img.shields.io/badge/node-24-3c873a.svg)](./.nvmrc)
[![Conventional Commits](https://img.shields.io/badge/commits-conventional-fe5196.svg)](https://www.conventionalcommits.org/)

</div>

---

You give it three things — **company**, **person**, **meeting context** — and it
returns one screen: a snapshot, the meeting objective, talking points, decision
asks, risk alerts, and buying signals. **Every claim links to its source.**

> **Status:** `2.0` — graduated from MVP to a stable, documented release line.
> Direction lives in [`PLAN.md`](./PLAN.md); work lives in
> [GitHub Issues](https://github.com/punyamsingh/ARGUS/issues); how to help lives
> in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Contents

- [How it works](#how-it-works)
- [Stack](#stack)
- [Quickstart](#quickstart)
- [Saved briefs & sign-in](#saved-briefs--sign-in)
- [Demo mode](#demo-mode)
- [Getting the free keys](#getting-the-free-keys)
- [Contributing](#contributing)
- [Versioning & releases](#versioning--releases)
- [Project layout](#project-layout)

## How it works

```
input (company · person · context)
        │
        ▼
   ┌─────────┐     ┌──────────────────────────┐     ┌────────────┐
   │ resolve │ ──▶ │ gather (parallel toolbelt)│ ──▶ │ synthesise │ ──▶ cited brief
   └─────────┘     └──────────────────────────┘     └────────────┘
   which company    Wikipedia · company site ·        grounded, every
   & person, with   job boards · GDELT news ·         claim cites a
   identifiers      SEC EDGAR  (more landing)          piece of evidence
```

1. **Resolve** — turn "meeting Jane at Acme" into concrete entities (domain,
   ticker, CIK, job-board slug, …) the tools can act on.
2. **Gather** — every applicable tool fans out in parallel for real, cited
   evidence. Each tool self-routes (`appliesTo`), times out independently, and
   fails soft — one tool erroring never sinks the brief.
3. **Synthesise** — the model writes the brief **only** from gathered evidence;
   anything it can't cite is dropped. Thin evidence → an honest, sparse brief,
   never fabrication.

The tool belt today: **Wikipedia/Wikidata**, **company website**, **job boards**
(Greenhouse/Lever), **GDELT** news & sentiment, **SEC EDGAR** filings. All free,
most keyless.

Once a brief exists you can **ask grounded follow-ups** beneath it — the same
evidence base answers your questions, still cited, no invented extras.

## Stack

- **Next.js (App Router) + React + TypeScript + Tailwind v4**
- **Vercel AI SDK** — provider-agnostic LLM layer (default: free Google Gemini)
- **Langfuse** — observability (free tier / self-host)
- **Supabase Postgres + Better Auth** — optional accounts and saved briefs,
  spoken to with the `pg` driver and plain SQL (no ORM — it's five queries over
  one table)
- Deployed on **Vercel** (preview per PR, production on `main`)

## Quickstart

Requires **Node 24** (see [`.nvmrc`](./.nvmrc)) and **pnpm**.

```bash
pnpm install
cp .env.example .env.local   # then fill in GEMINI_API_KEY (see below)
pnpm dev                     # http://localhost:3000
```

Scripts:

```bash
pnpm dev        # local dev server
pnpm build      # production build
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
pnpm eval       # grounding-invariant evals (vitest)
```

## Saved briefs & sign-in

**Optional.** With none of it configured, ARGUS behaves exactly as it always
has: briefs generate, land in your browser's `localStorage`, and no sign-in
control is rendered. Configure it and visitors can sign in with Google and have
their briefs persist to their account — listable, re-openable on another device,
and deletable.

Sign-in is never required. Anonymous visitors keep the full flow, and `/demo`
stays public. Demo briefs are never written to an account.

**1. Create a Supabase project** (free tier) and copy two connection strings from
*Project Settings → Database*:

| Which | Port | Used for |
|---|---|---|
| Transaction pooler | `6543` | the running app — set this as `DATABASE_URL` |
| Direct connection | `5432` | applying the SQL below (the pooler can't run DDL reliably) |

**2. Apply the schema**, in order:

```bash
psql "$DIRECT_DATABASE_URL" -f sql/0001_auth.sql   # accounts + sessions
psql "$DIRECT_DATABASE_URL" -f sql/0002_brief.sql  # saved briefs
```

Or paste each file into the Supabase SQL editor. `sql/0001_auth.sql` is
**generated** — regenerate it after upgrading `better-auth` with
`DATABASE_URL=<empty db> pnpm db:auth-sql` and commit the diff, rather than
editing it by hand.

**3. Create a Google OAuth client** — [Google Cloud console → Credentials](https://console.cloud.google.com/apis/credentials)
→ *Create credentials → OAuth client ID → Web application*. Add an authorised
redirect URI of `<BETTER_AUTH_URL>/api/auth/callback/google`.

> ⚠️ Google matches redirect URIs **exactly**, and Vercel gives every preview
> deployment a fresh URL. Register `http://localhost:3000/api/auth/callback/google`
> and your production callback; sign-in will not work on ad-hoc preview URLs
> unless you assign a stable preview domain and register that too.

**4. Set the five variables** from [`.env.example`](./.env.example):
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`. They're all-or-nothing — the sign-in control only
appears once the database *and* the Google credentials are present.

Briefs you generated before signing in aren't lost: on first sign-in this
browser's saved briefs are moved into your account, once.

## Demo mode

A presenter surface for showing ARGUS end to end without depending on live
networks. It lives at **`/demo`** — the home page with a scripted account —
reachable from the floating **Demo** control pinned to the bottom-right of every
page, which becomes **Exit demo** while you're there. The URL *is* the demo, so
it can be shared as-is with no setup.

On that route:

- the studio form is laced with a scripted account — company, contact, meeting
  context and seller profile — and locked, so a walkthrough always runs the same
  known-good meeting;
- **Resolve** and **Gather** are replaced by a fixed evidence store of nine real,
  clickable public sources ([`src/lib/demo/scenario.ts`](./src/lib/demo/scenario.ts));
- **Synthesis is still a real model call** — the brief an audience watches appear
  is genuinely written by the LLM, grounded in that evidence, in a few seconds
  and with no third-party rate limits;
- follow-up questions answer over the same scripted store (no live gather), so
  the whole demo is self-contained;
- the brief is stamped **Demo data** in its header and `meta.demo` in its JSON —
  a scripted run can never be mistaken for a live one.

Generating leaves `/demo` for the focused brief page, as it does normally; the
demo flag travels with the request, so the brief and its follow-ups stay
scripted. Your own saved seller profile and brief history are left untouched.

## Getting the free keys

### `GEMINI_API_KEY` — required, free, no card

1. Go to **[Google AI Studio → API keys](https://aistudio.google.com/apikey)**.
2. Sign in with a Google account, click **Create API key**.
3. Copy it into `.env.local` as `GEMINI_API_KEY=...` (and into Vercel for
   deploys — see below).

The free tier is generous for development. Rate limits apply (requests/min and
requests/day per model); if you hit them you'll see a clear error in the UI, not
a crash. The default model is `gemini-2.5-flash`.

### Langfuse keys — optional, for observability

1. Create a free project at **[cloud.langfuse.com](https://cloud.langfuse.com)**
   (or self-host the OSS version).
2. Project **Settings → API Keys** → create a key pair.
3. Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL`
   (EU `https://cloud.langfuse.com` · US `https://us.cloud.langfuse.com`).

With the keys set, each brief is exported to Langfuse as **one trace tree** —
`brief → resolve → each gather tool → synthesize` — with per-step latency, token
usage, model, and cost. The Vercel AI SDK emits OpenTelemetry spans
(`experimental_telemetry`) and the pipeline adds spans via `@langfuse/tracing`;
the `@langfuse/otel` `LangfuseSpanProcessor` (registered in `instrumentation.ts`,
`exportMode: "immediate"` for serverless) ships them, and the route force-flushes
via `after()`. ARGUS runs fine without Langfuse; with no keys, nothing is
registered and nothing is emitted.

### Tool keys — optional

Most gather tools are keyless. A few optional keys unlock extra tools or raise
rate limits — see [`.env.example`](./.env.example) for the full list (Finnhub,
SEC EDGAR User-Agent, GitHub token). Each one no-ops gracefully when absent.

## Contributing

Contributions are welcome. Read **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** for the
short version: pick an issue, branch, keep `typecheck` / `lint` / `build` / `eval`
green, and open a PR whose **title is a Conventional Commit** — CI enforces it, and
that title is what drives the next release.

The `/api/brief` route runs on the Node runtime with `maxDuration` set to fit the
sub-60s brief target — keep that budget in mind when adding gather tools.

## Versioning & releases

ARGUS uses **[semantic-release](https://semantic-release.gitbook.io/)** driven by
**[Conventional Commits](https://www.conventionalcommits.org/)**. The current
version is shown in the top-right of the site (linking to its release) and is read
from `package.json` at build time.

- **PR titles are enforced** by CI (`.github/workflows/pr-title.yml`) to follow
  `type(scope)!: subject`, e.g. `feat: add LinkedIn gather tool`. Squash-merge so
  this title becomes the commit semantic-release analyses.
- **On every push to `main`** (`.github/workflows/release.yml`) semantic-release
  reads the commits since the last `v*` tag and decides the bump — `feat` → minor,
  `fix`/`refactor`/`perf` → patch, `!`/`BREAKING CHANGE` → major — then bumps
  `package.json`, updates `CHANGELOG.md`, commits both back to `main` (with
  `[skip ci]`), tags `vX.Y.Z`, and publishes a GitHub Release. `docs`/`chore`/
  `style`/`ci`/`test` commits ship no release.
- Behaviour is configured in [`.releaserc.json`](./.releaserc.json). The release job
  authenticates with a `SEMANTIC_RELEASE_TOKEN` secret (a fine-grained PAT) that only
  needs **Contents: write** — issue/PR comments and labels are disabled, so no other
  scopes are required. When `main` is protected, the token's identity must be on the
  ruleset bypass list so it can push the `chore(release)` commit and tag.
- The baseline version `0.18.3` (tagged `v0.18.3`) was computed by replaying this
  scheme over the full history — run `pnpm version:compute` for the per-commit
  ledger. semantic-release picks up from that tag.

## Project layout

```
sql/              # schema, applied in order (0001 is generated — see above)
scripts/          # one-off maintenance (regenerate the auth schema, versioning)
src/
  app/            # Next.js App Router — pages + /api/brief, /api/briefs, /api/auth
  components/     # UI (brief studio, brief result, chrome)
  db/             # lazy pg pool + the parameterised query helper
  lib/
    auth/         # Better Auth — server instance, browser client
    briefs/       # saved briefs — row mapping, SQL repo, client library facade
    llm/          # provider-agnostic model factory (Gemini / Claude)
    agent/        # the pipeline
      resolve.ts    # entity resolution
      gather.ts     # parallel orchestrator
      synthesize.ts # grounded brief synthesis
      brief.ts      # resolve → gather → synthesize
      ask.ts        # grounded follow-up engine
      tools/        # the gather tool belt (one file per tool)
    demo/         # demo mode — the scripted account + the presenter switch
  types/          # zod schemas = the single source of truth
```

See [`PLAN.md`](./PLAN.md) for the full picture.

## License

[MIT](./LICENSE) © ARGUS contributors.
