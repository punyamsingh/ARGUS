import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";
import { jsonHeaders as HEADERS, bareHost, CLAIM_MAX, truncate } from "./shared";

/**
 * Job-board APIs (#26) — the sleeper hit, feeding Buying signals.
 *
 * Live open roles are a direct buying signal: hiring spikes mean budget, growth
 * and which teams are expanding. We probe the public Greenhouse and Lever boards
 * for a handful of slug guesses (from the resolved entity, domain, and name),
 * take the first that returns jobs, and summarise openings by department,
 * location, and notable senior roles. Free, public JSON. No board → empty.
 */

const SENIOR_RE = /\b(chief|c[etfo]o|cto|cfo|ceo|vp|vice president|head of|director|principal|staff|distinguished|lead)\b/i;

interface Posting {
  title: string;
  department: string | null;
  location: string | null;
  url: string;
}

interface Board {
  provider: "Greenhouse" | "Lever";
  boardUrl: string;
  postings: Posting[];
}

export const jobBoardTool: GatherTool = {
  name: "jobboards",
  appliesTo: (entity) => Boolean(entity.company.name),

  async run(entity: ResolvedEntity, signal: AbortSignal): Promise<RawEvidence[]> {
    const slugs = candidateSlugs(entity);
    if (slugs.length === 0) return [];

    const board = await firstBoardWithJobs(slugs, signal);
    if (!board || board.postings.length === 0) return [];

    const now = new Date().toISOString();
    const evidence: RawEvidence[] = [];
    const total = board.postings.length;

    const byDept = topCounts(board.postings.map((p) => p.department));
    const byLoc = topCounts(board.postings.map((p) => p.location));
    const deptStr = byDept.length
      ? ` Top teams: ${byDept.map(([k, n]) => `${k} (${n})`).join(", ")}.`
      : "";
    const locStr = byLoc.length
      ? ` Hiring in: ${byLoc.map(([k, n]) => `${k} (${n})`).join(", ")}.`
      : "";

    evidence.push({
      claim: truncate(
        `Hiring signal — ${total} open role${total === 1 ? "" : "s"} on ${board.provider}.${deptStr}${locStr}`,
        CLAIM_MAX,
      ),
      sourceUrl: board.boardUrl,
      sourceTitle: `${entity.company.name} — ${board.provider} careers`,
      retrievedAt: now,
    });

    const senior = board.postings.filter((p) => SENIOR_RE.test(p.title)).slice(0, 6);
    if (senior.length > 0) {
      const list = senior
        .map((p) => (p.location ? `${p.title} (${p.location})` : p.title))
        .join("; ");
      evidence.push({
        claim: truncate(
          `Senior openings (expansion signal): ${list}.`,
          CLAIM_MAX,
        ),
        sourceUrl: board.boardUrl,
        sourceTitle: `${entity.company.name} — ${board.provider} careers`,
        retrievedAt: now,
      });
    }

    return evidence;
  },
};

async function firstBoardWithJobs(
  slugs: string[],
  signal: AbortSignal,
): Promise<Board | null> {
  for (const slug of slugs) {
    const greenhouse = await fetchGreenhouse(slug, signal).catch(() => null);
    if (greenhouse && greenhouse.postings.length > 0) return greenhouse;
    const lever = await fetchLever(slug, signal).catch(() => null);
    if (lever && lever.postings.length > 0) return lever;
  }
  return null;
}

// ── Greenhouse ───────────────────────────────────────────────
// The departments endpoint gives both the team breakdown and per-job location.

interface GhJob {
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
}
interface GhDept {
  name?: string;
  jobs?: GhJob[];
}
interface GhResponse {
  departments?: GhDept[];
}

async function fetchGreenhouse(
  slug: string,
  signal: AbortSignal,
): Promise<Board | null> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/departments`;
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) return null;
  const json = (await res.json()) as GhResponse;
  const postings: Posting[] = [];
  for (const dept of json.departments ?? []) {
    for (const job of dept.jobs ?? []) {
      if (!job.title) continue;
      postings.push({
        title: job.title.trim(),
        department: clean(dept.name),
        location: clean(job.location?.name),
        url: job.absolute_url ?? `https://boards.greenhouse.io/${slug}`,
      });
    }
  }
  return {
    provider: "Greenhouse",
    boardUrl: `https://boards.greenhouse.io/${slug}`,
    postings,
  };
}

// ── Lever ────────────────────────────────────────────────────

interface LeverPosting {
  text?: string;
  categories?: { team?: string; location?: string };
  hostedUrl?: string;
}

async function fetchLever(
  slug: string,
  signal: AbortSignal,
): Promise<Board | null> {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) return null;
  const json = (await res.json()) as LeverPosting[];
  if (!Array.isArray(json)) return null;
  const postings: Posting[] = json
    .filter((p) => p.text)
    .map((p) => ({
      title: (p.text ?? "").trim(),
      department: clean(p.categories?.team),
      location: clean(p.categories?.location),
      url: p.hostedUrl ?? `https://jobs.lever.co/${slug}`,
    }));
  return {
    provider: "Lever",
    boardUrl: `https://jobs.lever.co/${slug}`,
    postings,
  };
}

// ── slug guessing ────────────────────────────────────────────

function candidateSlugs(entity: ResolvedEntity): string[] {
  const out: string[] = [];
  const push = (s?: string | null) => {
    const slug = normalizeSlug(s);
    if (slug && !out.includes(slug)) out.push(slug);
  };

  push(entity.company.jobBoardSlug);
  push(secondLevelDomain(entity.company.domain));
  push(entity.company.name);
  // A no-spaces fallback for multi-word names ("Acme Corp" → "acmecorp").
  push(entity.company.name?.replace(/\s+/g, ""));

  return out;
}

function normalizeSlug(value?: string | null): string | null {
  if (!value) return null;
  const slug = value
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|plc|gmbh)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  return slug.length >= 2 ? slug : null;
}

function secondLevelDomain(domain?: string): string | null {
  const host = bareHost(domain);
  if (!host) return null;
  const parts = host.split(".").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

// ── helpers ──────────────────────────────────────────────────

function topCounts(values: (string | null)[], limit = 4): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function clean(s?: string | null): string | null {
  const t = s?.trim();
  return t ? t : null;
}
