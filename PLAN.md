# ARGUS — Build Plan

> AI-powered **pre-meeting intelligence agent** for B2B sales reps. Turns 45–60 minutes
> of scattered pre-meeting research into a single, conversation-ready brief in under
> five minutes — synthesised, cited, and delivered at the moment of need.
>
> This document is the durable north star. Detailed, trackable work lives in
> **GitHub Issues** (so progress survives even if working context is lost).

---

## 1. The core insight

The pitch (see `ARGUS_Phase_1`) treats the LLM as the magic. It isn't — synthesis is
the commodity part now. The value-determining, genuinely hard parts are:

1. **Getting accurate, current data about a specific company + person.** This is the
   moat and the cost center, not the writing.
2. **Not hallucinating.** The promise of <2% hallucination is only real if every claim
   is grounded in a retrieved source with a citation — never free-associated.
3. **Entity resolution.** "Meeting Jane Smith at Acme" — *which* Jane, *which* Acme.
   Get this wrong and the whole brief is confidently useless.

Calendar sync, CRM integration, and team workspaces are real but are *plumbing* bolted
on once the core works. **The MVP must prove #1–3 or nothing else matters.**

## 2. The data layer — a belt of specialized tools (the moat)

Google Search grounding is **breadth** — prose, not structured signals. The moat is a set
of **specialized, typed, read-only tools** the gather step calls *conditionally* on the
resolved entity. Every MVP tool is **free + API-accessible + ToS-clean**.

### MVP tool belt (all free)

| Tool | Signal | Feeds |
|---|---|---|
| **Gemini Google Search grounding** | Broad web + news, with citations | everything (baseline) |
| **Wikipedia / Wikidata** | Structured firmographics: founded, HQ, industry, leadership, subsidiaries | Snapshot (+ sharpens entity resolution) |
| **Company website fetch** | First-party truth: newsroom, careers, blog, pricing | Snapshot, Buying signals |
| **Job-board APIs** (Greenhouse, Lever — public JSON) | Live open roles → hiring spikes, which teams, where | **Buying signals** (the sleeper hit) |
| **SEC EDGAR** | 10-K/Q financials, **8-K material events**, **Form D** private fundraising, insider trades | Financials, **Risk alerts**, **Buying signals** |
| **GDELT** | Global news + **tone/sentiment** at scale (no key) | **Risk alerts** (negative-press radar) |
| **Financial markets** (Finnhub / Alpha Vantage, free tier) | Stock moves, earnings dates (public cos) | Financials, Risk alerts |

### Stretch tools (free, niche)

| Tool | Signal | Note |
|---|---|---|
| **OpenCorporates / Companies House** | Official entity registry, officers, filings | Entity verification, esp. non-US/UK |
| **GitHub API** | Public activity of technical buyers | Only for dev-tool / eng-leader sales |

### Deferred / excluded

| Source | Why |
|---|---|
| Crunchbase / BuiltWith / Clearbit / X | Paid / gated — *Phase 2* when there's budget |
| CRM (Salesforce / HubSpot) | OAuth the user's **own** CRM — legit but an integration — *Phase 2* |
| **LinkedIn profile/activity** | ⚠️ Scraping violates ToS; LinkedIn litigates (hiQ v. LinkedIn). No API for arbitrary profiles. The pitch hand-waves exactly the hardest, most fraught source. **Excluded.** |

### Conditional routing (don't call everything every time)

- **Always:** Google Search + Wikipedia/Wikidata + website fetch + GDELT
- **If US public company** → SEC EDGAR (financials, 8-K) + financial markets
- **If private company** → SEC Form D + job boards
- **If technical buyer** → GitHub

All tools are **read-only → safe to run in parallel.** Each returns the shared `Evidence[]`
shape so synthesis treats every source identically. Tradeoffs to manage: latency,
free-tier rate limits, and a hard dependency on accurate entity resolution (need the right
ticker / board slug / domain first — see issue #4).

## 3. Architecture — an agentic RAG pipeline

```
Trigger (manual input for v0; calendar later)
  → Entity resolution (disambiguate company + person; resolve ticker/domain/board slug)
  → Gather orchestrator → fans out to the tool belt IN PARALLEL, conditional on entity:
        Google Search · Wikipedia/Wikidata · website fetch · job boards ·
        SEC EDGAR · GDELT · financial markets   (see §2)
  → Evidence store (every tool returns the same Evidence shape: claim + source URL + timestamp)
  → Synthesis agent: writes the brief grounded ONLY in evidence, with citations
  → Single-screen brief (objectives · talking points · decision asks · risk alerts · buying signals)
```

**The non-negotiable discipline:** the model writes only from the evidence it gathered,
and every fact carries a citation. That is what turns "<2% hallucination" from a slogan
into an engineering target.

## 4. The thinnest MVP that proves the thesis

> Type a **company + person + meeting context** → get a genuinely useful, **cited**,
> conversation-ready brief in **under 60 seconds**.

- Manual input (no calendar/CRM yet — those are integrations, not the core value).
- Data via **Gemini Flash + Google Search grounding**, which returns cited results.
  Collapses "build 6 data integrations" into one grounded, cited gather step — and
  directly attacks the hallucination problem. **Free tier, no per-call cost.**
- A clean **single-screen brief** UI.
- **Cache** account research so re-briefing the same company is cheap (the stated
  unit-economics lever — and it keeps us inside free-tier rate limits).

### Cost — building on the free tier

The MVP runs on **Google Gemini's free tier ($0 inference)**. Gemini Flash plus built-in
Google Search grounding covers both synthesis and the cited-data step at no cost. The only
real constraints are **rate limits** (fine for building + demoing; not for production
scale) and free-tier **data policy** (acceptable — we query public company info, not
secrets). This is why caching (issue #12) matters even early: it keeps repeat briefs
inside the rate limits.

*Production economics are a later problem.* When there's revenue/credits, premium briefs
can route to a paid frontier model (e.g. Claude Opus, ~single-digit cents/brief) via the
provider abstraction below — a config swap, not a rewrite.

## 5. Tech stack

- **Next.js + TypeScript** full-stack app (clean single-screen brief UI; trivial to
  deploy to Vercel for a live, shareable demo).
- **Vercel AI SDK** (`ai` + provider packages) is the framework layer — not a hand-rolled
  abstraction. It gives us, in one place:
  - **Provider switching** as a one-line change (`@ai-sdk/google` → `@ai-sdk/anthropic` …)
  - **Structured output** via `generateObject({ schema })` (+ zod) → guaranteed `Brief` shape
  - **Tool calling** via `tool()` + zod for the gather tools
  - **Streaming** + React hooks for the live progress UI
- **Default provider: Google Gemini** (`@ai-sdk/google`) — Gemini Flash for synthesis,
  Google Search grounding for the cited gather step. Free tier.
- **No vendor lock-in:** swapping in Claude/Opus (or any provider) for premium briefs is a
  config change, not a rewrite.
- **Observability — Langfuse (free/OSS).** The AI SDK emits OpenTelemetry spans; we wire
  them into Langfuse (free cloud tier or self-host) for traces, token/cost, and latency
  per call and per tool. Portable, no lock-in. (This is most of issue #15 for free.)

## 6. The brief format (single screen)

1. **Snapshot** — who/what, one-line company + person context
2. **Meeting objective** — inferred from the user's context line
3. **Talking points** — tailored, conversation-ready
4. **Decision asks** — what to push for
5. **Risk alerts** — layoffs, bad earnings, negative press
6. **Buying signals** — hiring spikes, funding, expansion

Every surfaced fact links to its source. No source → it doesn't go in the brief.

## 7. Roadmap (phases)

- **Phase 1 — MVP (the demo):** manual input → cited brief, single screen, deployed.
- **Phase 2 — Real integrations:** calendar trigger (proactive), CRM OAuth,
  public-company financials, more signal sources.
- **Phase 3 — Margins & scale:** caching + model-tier routing hardening, hallucination
  eval harness, cost/latency instrumentation.
- **Phase 4 — Team:** shared workspace, manager visibility, SDR upstream use.

## 8. Guardrails / definition of "done" for the MVP

- A brief generates end-to-end from manual input in < 60s.
- Every factual claim in a brief carries a working citation.
- No-evidence facts are omitted, not invented.
- Refusals and tool errors are handled gracefully (never a blank screen).
- The app is deployed and shareable.

---

*Work is tracked in GitHub Issues. This file captures direction; issues capture tasks.*
