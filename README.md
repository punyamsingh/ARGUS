# Argus

**A**gentic **R**esearch **G**enerated to **U**nburden **S**alespeople.

Argus is an AI **pre-meeting intelligence agent** for B2B sales reps. It turns 45
minutes of scattered account research into a single, **cited**, conversation-ready
brief — synthesised from real-time signals in the minutes before a meeting.

> **Status:** early MVP, built in the open one issue at a time.
> Direction lives in [`PLAN.md`](./PLAN.md); work lives in
> [GitHub Issues](https://github.com/punyamsingh/ARGUS/issues)
> (tracked by [the epic](https://github.com/punyamsingh/ARGUS/issues/20)).

## Stack

- **Next.js (App Router) + TypeScript + Tailwind v4**
- **Vercel AI SDK** — provider-agnostic LLM layer (default: free Google Gemini)
- **Langfuse** — observability
- Deployed on **Vercel**

## Quickstart

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

A full setup guide (free Gemini & Langfuse keys, env vars) lands with
[issue #34](https://github.com/punyamsingh/ARGUS/issues/34).

## Configuration

Copy [`.env.example`](./.env.example) → `.env.local` (or set the vars in Vercel).
The LLM layer is provider-agnostic — **switching providers is one env change**:

```bash
# default — free Google Gemini (key: https://aistudio.google.com/apikey)
LLM_PROVIDER=gemini
GEMINI_API_KEY=...

# swap to Claude with no code changes
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
```

**Connectivity check:** with a key set, `GET /api/ping-llm` returns
`{ ok: true, provider, model, text }`. (Temporary probe — removed when the real
`/api/brief` pipeline lands.)

## Architecture (target)

```
input (company · person · context)
  → resolve entity  → gather (parallel tool belt)  → synthesise (cited brief)
  → single-screen brief
```

See [`PLAN.md`](./PLAN.md) for the full picture.
