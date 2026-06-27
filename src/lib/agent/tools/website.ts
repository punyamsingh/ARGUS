import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";

/**
 * Company website fetch (#25) — first-party truth.
 *
 * Fetches a small set of high-signal pages on the company's own domain
 * (about / newsroom / blog / careers / pricing), extracts readable text, and
 * turns them into evidence. Runs only when a domain is known. Polite: a clear
 * UA, a best-effort robots.txt check, per-page timeouts, and tight caps.
 */

const HEADERS = {
  "User-Agent": "ARGUS/0.1 (+https://github.com/punyamsingh/ARGUS)",
  Accept: "text/html,application/xhtml+xml",
};

const PER_PAGE_TIMEOUT_MS = 6_000;
const MAX_HTML_BYTES = 600_000;
const CLAIM_MAX = 400;

const CANDIDATES: { path: string; label: string }[] = [
  { path: "/", label: "Homepage" },
  { path: "/about", label: "About" },
  { path: "/newsroom", label: "Newsroom" },
  { path: "/press", label: "Press" },
  { path: "/blog", label: "Blog" },
  { path: "/careers", label: "Careers" },
  { path: "/pricing", label: "Pricing" },
];

export const websiteTool: GatherTool = {
  name: "website",
  appliesTo: (entity) => Boolean(entity.company.domain),

  async run(entity: ResolvedEntity, signal: AbortSignal): Promise<RawEvidence[]> {
    const host = normalizeHost(entity.company.domain);
    if (!host) return [];
    const base = `https://${host}`;

    const disallowed = await fetchDisallows(base, signal);
    const pages = CANDIDATES.filter((c) => !isDisallowed(c.path, disallowed));

    const now = new Date().toISOString();
    const settled = await Promise.allSettled(
      pages.map((c) => fetchPage(base, c, signal)),
    );

    const evidence: RawEvidence[] = [];
    for (const result of settled) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { label, url, title, description, snippet } = result.value;
      const claim = buildClaim(label, title, description, snippet);
      if (claim) {
        evidence.push({
          claim,
          sourceUrl: url,
          sourceTitle: `${entity.company.name} website — ${label}`,
          retrievedAt: now,
        });
      }
    }
    return evidence;
  },
};

interface PageResult {
  label: string;
  url: string;
  title: string | null;
  description: string | null;
  snippet: string | null;
}

async function fetchPage(
  base: string,
  candidate: { path: string; label: string },
  parent: AbortSignal,
): Promise<PageResult | null> {
  const url = `${base}${candidate.path}`;
  const signal = AbortSignal.any([parent, AbortSignal.timeout(PER_PAGE_TIMEOUT_MS)]);
  const res = await fetch(url, { signal, headers: HEADERS, redirect: "follow" });
  if (!res.ok) return null;
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) return null;

  const html = (await res.text()).slice(0, MAX_HTML_BYTES);
  return {
    label: candidate.label,
    url: res.url || url,
    title: extractTitle(html),
    description: extractDescription(html),
    snippet: extractText(html),
  };
}

function buildClaim(
  label: string,
  title: string | null,
  description: string | null,
  snippet: string | null,
): string | null {
  const body = description || snippet || title;
  if (label === "Careers") {
    return truncate(
      `Active careers page (hiring signal).${body ? ` ${body}` : ""}`,
      CLAIM_MAX,
    );
  }
  if (label === "Pricing") {
    return truncate(
      `Public pricing page available.${body ? ` ${body}` : ""}`,
      CLAIM_MAX,
    );
  }
  if (!body) return null;
  return truncate(`${label}: ${body}`, CLAIM_MAX);
}

// ── HTML helpers (no DOM; light + dependency-free) ───────────

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(collapse(m[1])) || null : null;
}

function extractDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1].trim()) return decodeEntities(collapse(m[1]));
  }
  return null;
}

function extractText(html: string): string | null {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(collapse(stripped));
  return text ? truncate(text, CLAIM_MAX) : null;
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

// ── domain + robots ──────────────────────────────────────────

function normalizeHost(domain?: string): string | null {
  if (!domain) return null;
  const host = domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\/$/, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? host : null;
}

async function fetchDisallows(
  base: string,
  parent: AbortSignal,
): Promise<string[]> {
  try {
    const signal = AbortSignal.any([parent, AbortSignal.timeout(4_000)]);
    const res = await fetch(`${base}/robots.txt`, { signal, headers: HEADERS });
    if (!res.ok) return [];
    return parseDisallows(await res.text());
  } catch {
    return [];
  }
}

/** Collect Disallow paths under the `User-agent: *` group (best-effort). */
function parseDisallows(robots: string): string[] {
  const disallows: string[] = [];
  let appliesToAll = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const key = field.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") appliesToAll = value === "*";
    else if (key === "disallow" && appliesToAll && value) disallows.push(value);
  }
  return disallows;
}

function isDisallowed(path: string, disallows: string[]): boolean {
  return disallows.some((d) => d === "/" || path.startsWith(d));
}
