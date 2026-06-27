import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";

/**
 * GDELT news & sentiment radar (#28) — always-on.
 *
 * GDELT's DOC 2.0 API indexes worldwide news with no key. We run two passes
 * over a recent window: the latest coverage (general signal) and a negative-tone
 * slice (`tone<-3`) that surfaces layoffs, lawsuits, scandals and bad earnings as
 * risk evidence. Quiet companies simply return little. Free, no key.
 */

const DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";
const HEADERS = {
  "User-Agent": "ARGUS/0.1 (+https://github.com/punyamsingh/ARGUS)",
  Accept: "application/json",
};

const WINDOW_DAYS = 90;
const MAX_RECENT = 6;
const MAX_NEGATIVE = 5;

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
    const phrase = `"${entity.company.name}"`;
    const now = new Date();
    const start = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
    const window = { start: stamp(start), end: stamp(now) };

    // Two independent passes; either failing is non-fatal.
    const [recent, negative] = await Promise.all([
      query(phrase, window, signal, MAX_RECENT).catch(() => []),
      query(`${phrase} tone<-3`, window, signal, MAX_NEGATIVE).catch(() => []),
    ]);

    const retrievedAt = now.toISOString();
    const evidence: RawEvidence[] = [];
    const seen = new Set<string>();

    // Negative-tone first so the risk-bearing items survive de-duplication.
    for (const a of negative) {
      const item = toEvidence(a, "Negative-sentiment coverage", retrievedAt);
      if (item && !seen.has(item.sourceUrl)) {
        seen.add(item.sourceUrl);
        evidence.push(item);
      }
    }
    for (const a of recent) {
      const item = toEvidence(a, "Recent news", retrievedAt);
      if (item && !seen.has(item.sourceUrl)) {
        seen.add(item.sourceUrl);
        evidence.push(item);
      }
    }

    return evidence;
  },
};

async function query(
  q: string,
  window: { start: string; end: string },
  signal: AbortSignal,
  maxRecords: number,
): Promise<GdeltArticle[]> {
  const params = new URLSearchParams({
    query: `${q} sourcelang:english`,
    mode: "artlist",
    format: "json",
    sort: "datedesc",
    maxrecords: String(maxRecords),
    startdatetime: window.start,
    enddatetime: window.end,
  });
  const res = await fetch(`${DOC_API}?${params}`, { signal, headers: HEADERS });
  if (!res.ok) {
    console.warn(`gdelt: HTTP ${res.status} for query=${q}`);
    return [];
  }
  // GDELT replies with plain text on malformed/empty/rate-limited queries —
  // guard the parse and surface why, so empty briefs are diagnosable.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const body = (await res.text()).slice(0, 160).replace(/\s+/g, " ").trim();
    console.warn(`gdelt: non-JSON (${contentType}) for query=${q} — ${body}`);
    return [];
  }
  const json = (await res.json()) as GdeltResponse;
  return json.articles ?? [];
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
