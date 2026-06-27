import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";

/**
 * Wikipedia / Wikidata firmographics (#24) — always-on backbone.
 *
 * Free, no key. Search → REST summary for a company overview, plus a
 * best-effort Wikidata enrichment (founding year, ticker). Provides a reliable
 * structured base that sharpens grounding and reduces hallucination.
 */

const WIKI = "https://en.wikipedia.org";
const HEADERS = {
  "User-Agent": "ARGUS/0.1 (https://github.com/punyamsingh/ARGUS)",
  Accept: "application/json",
};

interface WikiSearchResponse {
  query?: { search?: { title: string }[] };
}

interface WikiSummary {
  title: string;
  type?: string;
  extract?: string;
  description?: string;
  wikibase_item?: string;
  content_urls?: { desktop?: { page?: string } };
}

interface WdSnak {
  mainsnak?: { datavalue?: { value?: unknown } };
}

interface WikidataResponse {
  entities?: Record<string, { claims?: Record<string, WdSnak[]> }>;
}

export const wikipediaTool: GatherTool = {
  name: "wikipedia",
  appliesTo: () => true,

  async run(entity: ResolvedEntity, signal: AbortSignal): Promise<RawEvidence[]> {
    const title = await searchTitle(entity.company.name, signal);
    if (!title) return [];

    const summary = await fetchSummary(title, signal);
    if (!summary || summary.type === "disambiguation") return [];

    const now = new Date().toISOString();
    const pageUrl =
      summary.content_urls?.desktop?.page ??
      `${WIKI}/wiki/${encodeURIComponent(title)}`;
    const evidence: RawEvidence[] = [];

    if (summary.extract) {
      evidence.push({
        claim: truncate(summary.extract, 600),
        sourceUrl: pageUrl,
        sourceTitle: `Wikipedia — ${summary.title}`,
        retrievedAt: now,
      });
    }

    // Best-effort structured facts from Wikidata; failures are non-fatal.
    if (summary.wikibase_item) {
      try {
        for (const fact of await wikidataFacts(summary.wikibase_item, signal)) {
          evidence.push({
            claim: fact,
            sourceUrl: `https://www.wikidata.org/wiki/${summary.wikibase_item}`,
            sourceTitle: `Wikidata — ${summary.title}`,
            retrievedAt: now,
          });
        }
      } catch {
        // ignore enrichment failures
      }
    }

    return evidence;
  },
};

async function searchTitle(
  company: string,
  signal: AbortSignal,
): Promise<string | null> {
  const url =
    `${WIKI}/w/api.php?action=query&format=json&list=search&srlimit=1&srprop=` +
    `&srsearch=${encodeURIComponent(company)}`;
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) return null;
  const json = (await res.json()) as WikiSearchResponse;
  return json.query?.search?.[0]?.title ?? null;
}

async function fetchSummary(
  title: string,
  signal: AbortSignal,
): Promise<WikiSummary | null> {
  const url = `${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) return null;
  return (await res.json()) as WikiSummary;
}

async function wikidataFacts(
  qid: string,
  signal: AbortSignal,
): Promise<string[]> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) return [];
  const json = (await res.json()) as WikidataResponse;
  const claims = json.entities?.[qid]?.claims ?? {};
  const facts: string[] = [];

  // P571 — inception (time value like "+2010-01-01T00:00:00Z")
  const inception = claims.P571?.[0]?.mainsnak?.datavalue?.value;
  const year = inceptionYear(inception);
  if (year) facts.push(`Founded in ${year}.`);

  // P249 — stock ticker (string)
  const ticker = claims.P249?.[0]?.mainsnak?.datavalue?.value;
  if (typeof ticker === "string") facts.push(`Stock ticker: ${ticker}.`);

  return facts;
}

function inceptionYear(value: unknown): string | null {
  if (value && typeof value === "object" && "time" in value) {
    const time = (value as { time?: string }).time;
    const match = time?.match(/^\+?(\d{4})/);
    if (match) return match[1];
  }
  return null;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
