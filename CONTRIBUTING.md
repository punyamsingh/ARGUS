# Contributing to ARGUS

Thanks for your interest in ARGUS — AI pre-meeting intelligence that turns scattered
account research into one cited, conversation-ready brief. This guide covers how to
get set up, the conventions the project enforces, and how changes ship.

ARGUS is built **in the open, one issue at a time**. Direction lives in
[`PLAN.md`](./PLAN.md); the work backlog lives in
[GitHub Issues](https://github.com/punyamsingh/ARGUS/issues).

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting set up](#getting-set-up)
- [Picking something to work on](#picking-something-to-work-on)
- [Development workflow](#development-workflow)
- [Quality gates](#quality-gates)
- [Commit & PR conventions](#commit--pr-conventions)
- [How releases happen](#how-releases-happen)
- [Project layout](#project-layout)
- [Adding a gather tool](#adding-a-gather-tool)
- [The grounding contract](#the-grounding-contract)

## Code of conduct

Be respectful, assume good faith, and keep discussion focused on the work. Harassment
or hostility of any kind is not welcome.

## Getting set up

You need **Node 22** (see [`.nvmrc`](./.nvmrc)) and **pnpm**.

```bash
pnpm install
cp .env.example .env.local   # fill in GEMINI_API_KEY (free, no card)
pnpm dev                     # http://localhost:3000
```

The only required key is `GEMINI_API_KEY` — grab a free one from
[Google AI Studio](https://aistudio.google.com/apikey). Everything else in
[`.env.example`](./.env.example) is optional and no-ops gracefully when absent. See
the [README](./README.md#getting-the-free-keys) for the full key walkthrough.

## Picking something to work on

- Browse [open issues](https://github.com/punyamsingh/ARGUS/issues). Comment on one
  to claim it before you start so we don't duplicate effort.
- Found a bug or have an idea? **Open an issue first** to discuss scope before
  writing code — it keeps PRs small and reviewable.
- Small, focused PRs land faster than large ones. One concern per PR.

## Development workflow

1. Branch off `main` with a descriptive name (e.g. `feat/linkedin-tool`,
   `fix/gdelt-429`).
2. Make your change. Keep it scoped to a single concern.
3. Run the [quality gates](#quality-gates) locally — they must pass.
4. Push and open a PR. The PR title **must** be a Conventional Commit (see below).
5. Address review feedback. We **squash-merge**, so the PR title becomes the commit
   that semantic-release analyses.

## Quality gates

CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs these on every PR.
Run them locally before pushing:

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm build       # production build
pnpm eval        # grounding-invariant evals (vitest)
```

All four must be green. The `eval` step guards the project's core invariant — that the
agent never asserts anything it can't cite (see [the grounding contract](#the-grounding-contract)).

## Commit & PR conventions

PR titles are enforced by CI ([`.github/workflows/pr-title.yml`](./.github/workflows/pr-title.yml))
and must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>)<optional !>: <subject>
```

**Allowed types:** `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `chore`,
`ci`, `test`, `build`, `revert`.

**How the type maps to a release:**

| Title                                  | Release  |
| -------------------------------------- | -------- |
| `feat: …`                              | minor    |
| `fix: …` · `refactor: …` · `perf: …`   | patch    |
| `feat!: …` or any `BREAKING CHANGE:`   | **major**|
| `docs:` · `chore:` · `style:` · `ci:` · `test:` · `build:` | no release |

Examples:

```
feat: add LinkedIn gather tool
fix(gdelt): serialize passes to avoid 429s
docs: rewrite the README cold-start guide
refactor!: drop the legacy resolver
```

The trailing **`!`** (and/or a `BREAKING CHANGE:` footer in the commit body) marks a
breaking change and forces a **major** version bump. Use it when you change a public
contract — an API route shape, an env-var name, a stored data format.

## How releases happen

Releases are fully automated by **[semantic-release](https://semantic-release.gitbook.io/)**;
you never bump a version by hand.

- On every push to `main` ([`.github/workflows/release.yml`](./.github/workflows/release.yml)),
  semantic-release reads the commits since the last `v*` tag, decides the bump from
  their types, then updates `package.json` + `CHANGELOG.md`, tags `vX.Y.Z`, and
  publishes a GitHub Release.
- Because we squash-merge, **your PR title is the commit it reads** — get it right.
- The version is surfaced in the top-right of the running site, linking to its release.

Full details are in the [README](./README.md#versioning--releases) and
[`.releaserc.json`](./.releaserc.json).

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
      ask.ts        # grounded follow-up engine
      tools/        # the gather tool belt (one file per tool)
  types/          # zod schemas = the single source of truth
```

## Adding a gather tool

Gather tools live in `src/lib/agent/tools/`, one file per tool. A good tool:

- **Self-routes** via `appliesTo` — it decides whether it's relevant to the resolved
  entities, so the orchestrator only runs what matters.
- **Times out independently** and **fails soft** — one tool erroring must never sink
  the brief. Return no evidence rather than throwing.
- **Returns cited evidence** — every piece carries the source it came from, because
  synthesis only keeps claims it can cite.
- **Degrades without keys** — if it needs an optional key (see `.env.example`), it
  no-ops cleanly when the key is absent.
- **Respects the latency budget** — the `/api/brief` route targets sub-60s, so keep
  network work parallel and bounded.

## The grounding contract

ARGUS's whole value is that **every claim links to its source**. The synthesis step
writes the brief *only* from gathered evidence; anything it can't cite is dropped.
Thin evidence yields an honest, sparse brief — never a fabricated one. The `pnpm eval`
grounding invariants exist to keep this true; don't weaken them to make a feature
pass.

---

Questions? Open an issue or start a discussion. Thanks for helping build ARGUS.
