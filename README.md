# ARGUS

**A**gentic **R**esearch **G**enerated to **U**nburden **S**alespeople.

ARGUS is an AI **pre-meeting intelligence agent** for B2B sales reps. It turns 45
minutes of scattered account research into a single, **cited**, conversation-ready
brief — synthesised from real-time public signals in the minutes before a meeting.

You give it three things — **company**, **person**, **meeting context** — and it
returns one screen: a snapshot, the meeting objective, talking points, decision
asks, risk alerts, and buying signals. **Every claim links to its source.**

> **Status:** MVP, built in the open one issue at a time.
> Direction lives in [`PLAN.md`](./PLAN.md); work lives in
> [GitHub Issues](https://github.com/punyamsingh/ARGUS/issues).

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

## Stack

- **Next.js (App Router) + React + TypeScript + Tailwind v4**
- **Vercel AI SDK** — provider-agnostic LLM layer (default: free Google Gemini)
- **Langfuse** — observability (free tier / self-host)
- Deployed on **Vercel** (preview per PR, production on `main`)

## Quickstart

Requires **Node 22** (see [`.nvmrc`](./.nvmrc)).

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
```

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

Most tools are keyless (Wikipedia, company site, job boards, GDELT, SEC EDGAR).
A financial-markets tool can use a free **Finnhub** key (`FINNHUB_API_KEY`) when
present; without it, that tool simply no-ops.

## Switching LLM provider

The LLM layer is provider-agnostic — **switching is one env change, no code**:

```bash
# default — free Google Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=...

# swap to Claude
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
```

Optionally pin a model with `LLM_MODEL` (defaults: `gemini-2.5-flash` /
`claude-opus-4-8`).

## Environment variables

All variables are documented in [`.env.example`](./.env.example). Copy it to
`.env.local` for local dev, or add them in **Vercel → Project → Settings →
Environment Variables** (scoped to Preview + Production) for deploys. **Never
commit real keys.**

## Deploy workflow

- The repo is connected to **Vercel**; **every PR gets a preview URL**, and
  merging to **`main` deploys production**. Preview deployments are the primary
  manual-testing surface.
- The `/api/brief` route runs on the Node runtime with `maxDuration` set to fit
  the sub-60s brief target.

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
src/
  app/            # Next.js App Router — pages + /api/brief route
  components/     # UI (brief studio, brief result, chrome)
  lib/
    llm/          # provider-agnostic model factory (Gemini / Claude)
    agent/        # the pipeline
      resolve.ts    # entity resolution
      gather.ts     # parallel orchestrator
      synthesize.ts # grounded brief synthesis
      brief.ts      # resolve → gather → synthesize
      tools/        # the gather tool belt (one file per tool)
  types/          # zod schemas = the single source of truth
```

See [`PLAN.md`](./PLAN.md) for the full picture.
