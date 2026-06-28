import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";

/**
 * GDELT news & sentiment radar (#28) — always-on.
 *
 * GDELT's DOC 2.0 API indexes worldwide news with no key. We make a recent-news
 * pass and, only when that succeeds (proving the IP isn't being throttled), a
 * second negative-tone pass (`tone<-3`) that surfaces layoffs, lawsuits, scandals
 * and bad earnings as risk evidence.
 *
 * Two realities shape this tool:
 *  - GDELT rate-limits aggressively (HTTP 429), especially from shared serverless
 *    IPs — so requests are sequential, retried with backoff, and the second pass
 *    is skipped when the first comes back empty.
 *  - Exact-phrase queries on a legal name ("Stripe, Inc.") match almost nothing,
 *    so we search the cleaned company name and only quote multi-word terms.
 *
 * Quiet companies (or a persistently throttled IP) return little, gracefully.
 */

const DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";
const HEADERS = {
  "User-Agent": "ARGUS/0.1 (+https://github.com/punyamsingh/ARGUS)",
  Accept: "application/json",
};

const WINDOW_DAYS = 90;
const MAX_RECENT = 6;
const MAX_NEGATIVE = 5;
const GAP_MS = 1_200; // spacing between passes to dodge rate limits
const RETRY_BACKOFFS_MS = [3_000, 5_000]; // growing waits before each 429 retry
const MAX_RETRY_MS = 6_000;

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string; // "20260615T120000Z"
  domain?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

export const gdeltTool: GatherTool = {
  name: "gdelt",
  appliesTo: (entity) => Boolean(entity.company.name),

  async run(entity: ResolvedEntity, signal: AbortSignal): Promise<RawEvidence[]> {
    const term = searchTerm(entity.company.name, entity.company.industry);
    if (!term) return [];

    const now = new Date();
    const start = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
    const window = { start: stamp(start), end: stamp(now) };

    // Recent-news pass first. Only attempt the negative-tone pass if it returned
    // something — a second request when the IP is throttled just burns budget.
    const recent = await query(term, window, signal, MAX_RECENT).catch(() => []);
    let negative: GdeltArticle[] = [];
    if (recent.length > 0) {
      await sleep(GAP_MS, signal).catch(() => {});
      negative = await query(`${term} tone<-3`, window, signal, MAX_NEGATIVE).catch(
        () => [],
      );
    }

    const retrievedAt = now.toISOString();
    const evidence: RawEvidence[] = [];
    const seen = new Set<string>();

    // Negative-tone first so the risk-bearing items survive de-duplication.
    for (const a of negative) {
      push(evidence, seen, toEvidence(a, "Negative-sentiment coverage", retrievedAt));
    }
    for (const a of recent) {
      push(evidence, seen, toEvidence(a, "Recent news", retrievedAt));
    }

    return evidence;
  },
};

function push(
  evidence: RawEvidence[],
  seen: Set<string>,
  item: RawEvidence | null,
): void {
  if (item && !seen.has(item.sourceUrl)) {
    seen.add(item.sourceUrl);
    evidence.push(item);
  }
}

async function query(
  term: string,
  window: { start: string; end: string },
  signal: AbortSignal,
  maxRecords: number,
): Promise<GdeltArticle[]> {
  const params = new URLSearchParams({
    query: `${term} sourcelang:english`,
    mode: "artlist",
    format: "json",
    sort: "datedesc",
    maxrecords: String(maxRecords),
    startdatetime: window.start,
    enddatetime: window.end,
  });
  const url = `${DOC_API}?${params}`;

  // GDELT's free API rate-limits aggressively; back off and retry on 429.
  let res = await fetch(url, { signal, headers: HEADERS });
  for (
    let attempt = 0;
    res.status === 429 && attempt < RETRY_BACKOFFS_MS.length;
    attempt++
  ) {
    await sleep(retryWaitMs(res, attempt), signal);
    res = await fetch(url, { signal, headers: HEADERS });
  }

  if (!res.ok) {
    console.warn(`gdelt: HTTP ${res.status} for query=${term}`);
    return [];
  }
  // GDELT replies with plain text on malformed/empty/rate-limited queries —
  // guard the parse and surface why, so empty briefs are diagnosable.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const body = (await res.text()).slice(0, 160).replace(/\s+/g, " ").trim();
    console.warn(`gdelt: non-JSON (${contentType}) for query=${term} — ${body}`);
    return [];
  }
  const json = (await res.json()) as GdeltResponse;
  return json.articles ?? [];
}

/**
 * Build a GDELT search term from the company name: drop a trailing legal suffix
 * (Inc., LLC, Ltd, …) so coverage actually matches, always quote the name for a
 * phrase match, and — crucially — AND in an industry context clause when known.
 * Company names are often common words ("Stripe", "Apple"); requiring the name
 * AND an industry term keeps results on-topic instead of matching the dictionary
 * word. GDELT ANDs space-separated terms, so `"Stripe" (financial OR saas)`
 * means: mentions Stripe and at least one industry term.
 */
function searchTerm(name: string, industry?: string): string | null {
  const cleaned = name
    .replace(/[,\s]+(inc|incorporated|llc|ltd|limited|corp|corporation|co|plc|gmbh|s\.?a|ag|nv)\.?$/i, "")
    .trim();
  const base = cleaned || name.trim();
  if (!base) return null;

  const quoted = `"${base}"`;
  const terms = industryTerms(industry);
  return terms.length ? `${quoted} (${terms.join(" OR ")})` : quoted;
}

const INDUSTRY_STOPWORDS = new Set([
  "and",
  "the",
  "of",
  "for",
  "services",
  "service",
  "company",
  "industry",
  "sector",
  "solutions",
  "technology",
  "technologies",
  "global",
  "international",
]);

/** A few salient, lowercased industry keywords to disambiguate the name. */
function industryTerms(industry?: string): string[] {
  if (!industry) return [];
  return industry
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !INDUSTRY_STOPWORDS.has(w))
    .slice(0, 3);
}

function toEvidence(
  a: GdeltArticle,
  prefix: string,
  retrievedAt: string,
): RawEvidence | null {
  if (!a.url || !a.title) return null;
  const date = formatSeen(a.seendate);
  const where = [a.domain, date].filter(Boolean).join(", ");
  const claim = where
    ? `${prefix} — "${a.title.trim()}" (${where}).`
    : `${prefix} — "${a.title.trim()}".`;
  return {
    claim,
    sourceUrl: a.url,
    sourceTitle: a.domain ? `${a.domain} — ${a.title.trim()}` : a.title.trim(),
    retrievedAt,
  };
}

/** GDELT wants compact UTC timestamps: YYYYMMDDHHMMSS. */
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

/** "20260615T120000Z" → "2026-06-15". */
function formatSeen(seen?: string): string | null {
  if (!seen) return null;
  const m = seen.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Backoff before a 429 retry — honour `Retry-After`, else grow per attempt. */
function retryWaitMs(res: Response, attempt: number): number {
  const header = res.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_MS);
  }
  return RETRY_BACKOFFS_MS[attempt] ?? MAX_RETRY_MS;
}

/** Cancellable delay — rejects if the abort signal fires first. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      },
      { once: true },
    );
  });
}
