import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";
import { ARGUS_UA, CLAIM_MAX, bareHost, stripLegalSuffix, truncate } from "./shared";

/**
 * GitHub (#31) — public open-source footprint for the company.
 *
 * Resolves the company's public GitHub organisation by guessing the org login
 * from its domain and name, then verifies the match (login / display name / the
 * org's listed website must line up with the company) before trusting it — so we
 * never attribute a random org's activity to the prospect. Surfaces neutral
 * context: the org's repo count, primary languages, and a few recently-active
 * public repos. Company-level only (matching a person to a GitHub handle is too
 * error-prone to ground safely).
 *
 * Deliberately framed as plain context, not a headline signal. No org match →
 * empty, never an error. Free; unauthenticated calls are rate-limited (60/hr) —
 * set GITHUB_TOKEN to raise that to 5000/hr.
 */

const API = "https://api.github.com";
const MAX_REPOS = 3;

interface Org {
  login?: string;
  name?: string;
  blog?: string;
  html_url?: string;
  public_repos?: number;
}

interface Repo {
  name?: string;
  html_url?: string;
  description?: string;
  language?: string | null;
  stargazers_count?: number;
  pushed_at?: string;
  fork?: boolean;
}

export const githubTool: GatherTool = {
  name: "github",
  appliesTo: (entity) => Boolean(entity.company.name),

  async run(entity: ResolvedEntity, signal: AbortSignal): Promise<RawEvidence[]> {
    const org = await resolveOrg(entity, signal);
    if (!org?.login) return [];

    const repos = await fetchRepos(org.login, signal);
    const now = new Date().toISOString();
    const evidence: RawEvidence[] = [];

    const langs = topLanguages(repos);
    const langStr = langs.length ? ` Primary languages: ${langs.join(", ")}.` : "";
    const count =
      typeof org.public_repos === "number" ? `${org.public_repos} public repos` : "public repos";

    evidence.push({
      claim: truncate(
        `Public GitHub organisation @${org.login}${org.name ? ` (${org.name})` : ""} — ${count}.${langStr}`,
        CLAIM_MAX,
      ),
      sourceUrl: org.html_url ?? `https://github.com/${org.login}`,
      sourceTitle: `GitHub — @${org.login}`,
      retrievedAt: now,
    });

    for (const repo of repos.filter((r) => !r.fork && r.name).slice(0, MAX_REPOS)) {
      const meta = [
        repo.language ?? null,
        typeof repo.stargazers_count === "number" ? `${repo.stargazers_count}★` : null,
        repo.pushed_at ? `updated ${repo.pushed_at.slice(0, 10)}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      const desc = repo.description?.trim();
      evidence.push({
        claim: truncate(
          `Public repo "${repo.name}"${meta ? ` (${meta})` : ""}${desc ? `: ${desc}` : "."}`,
          CLAIM_MAX,
        ),
        sourceUrl: repo.html_url ?? `https://github.com/${org.login}/${repo.name}`,
        sourceTitle: `GitHub — ${org.login}/${repo.name}`,
        retrievedAt: now,
      });
    }

    return evidence;
  },
};

function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": ARGUS_UA,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Try domain- and name-derived org logins; trust only a verified match. */
async function resolveOrg(
  entity: ResolvedEntity,
  signal: AbortSignal,
): Promise<Org | null> {
  for (const candidate of candidateLogins(entity)) {
    const res = await fetch(`${API}/orgs/${candidate.login}`, {
      signal,
      headers: ghHeaders(),
    });
    if (res.status === 403) {
      console.warn("github: HTTP 403 (rate limit?) — set GITHUB_TOKEN to raise limits");
      return null;
    }
    if (!res.ok) continue; // 404 → try next candidate
    const org = (await res.json()) as Org;
    if (verifyOrg(org, entity, candidate)) return org;
  }
  return null;
}

async function fetchRepos(login: string, signal: AbortSignal): Promise<Repo[]> {
  const url = `${API}/orgs/${login}/repos?sort=pushed&direction=desc&per_page=12&type=public`;
  const res = await fetch(url, { signal, headers: ghHeaders() });
  if (!res.ok) {
    console.warn(`github: repos HTTP ${res.status} for @${login}`);
    return [];
  }
  const json = (await res.json()) as Repo[];
  return Array.isArray(json) ? json : [];
}

interface Candidate {
  login: string;
  fromDomain: boolean;
}

function candidateLogins(entity: ResolvedEntity): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null, fromDomain: boolean) => {
    const login = normSlug(raw);
    if (login && !seen.has(login)) {
      seen.add(login);
      out.push({ login, fromDomain });
    }
  };
  add(secondLevelDomain(entity.company.domain), true);
  add(stripLegalSuffix(entity.company.name), false);
  add(entity.company.name, false);
  return out;
}

/**
 * Confirm an org actually belongs to the company. A domain-derived login is
 * trusted directly (the company owns that domain). A name-derived login needs
 * corroboration: the org's display name or its listed website must line up.
 */
function verifyOrg(org: Org, entity: ResolvedEntity, candidate: Candidate): boolean {
  if (candidate.fromDomain) return true;

  const target = normSlug(stripLegalSuffix(entity.company.name));
  if (target && normSlug(org.name) === target) return true;

  const orgHost = bareHost(org.blog);
  const compHost = bareHost(entity.company.domain);
  if (orgHost && compHost && registrable(orgHost) === registrable(compHost)) return true;

  return false;
}

function topLanguages(repos: Repo[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const r of repos) {
    if (r.fork || !r.language) continue;
    counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([l]) => l);
}

function secondLevelDomain(domain?: string): string | null {
  const host = bareHost(domain);
  if (!host) return null;
  const parts = host.split(".").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

/** Last two labels of a host, e.g. "blog.stripe.com" → "stripe.com". */
function registrable(host: string): string {
  const parts = host.split(".").filter(Boolean);
  return parts.slice(-2).join(".");
}

function normSlug(value?: string | null): string | null {
  if (!value) return null;
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return slug.length >= 2 ? slug : null;
}
