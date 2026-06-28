import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";

/**
 * SEC EDGAR (#27) — free, official-grade filings (public companies).
 *
 * Resolves the company to a CIK via SEC's official ticker map (`company_tickers
 * .json`) — by ticker, else by company name — then reads the submissions feed
 * for recent notable filings:
 *  - 8-K   → material events (risk)
 *  - 10-K / 10-Q / 20-F / 6-K → financial reports
 *  - S-1   → IPO registration
 *  - Form D → fundraising, when the filer is in the ticker map
 *
 * Routing: only public companies (ticker / cik / isPublic), since the ticker map
 * covers listed filers. (Private Form-D discovery needs EDGAR full-text search,
 * which `efts.sec.gov` blocks for server-side callers — out of scope here.)
 *
 * No CIK match → empty, never an error. Honours SEC fair-access: a declared
 * User-Agent (override via EDGAR_USER_AGENT) and a tight, capped set of requests.
 */

const SUBMISSIONS = "https://data.sec.gov/submissions";
const TICKERS = "https://www.sec.gov/files/company_tickers.json";
const HEADERS = {
  "User-Agent":
    process.env.EDGAR_USER_AGENT ??
    "ARGUS/0.1 (https://github.com/punyamsingh/ARGUS; contact: argus-agent@users.noreply.github.com)",
  Accept: "application/json",
};

const TICKER_TABLE_TTL_MS = 6 * 60 * 60 * 1000;

const WINDOW_DAYS = 400;
const MAX_FILINGS = 6;

// Forms we surface, in priority order, with how to describe them.
const NOTABLE: Record<string, string> = {
  "8-K": "Material event (8-K)",
  "10-K": "Annual report (10-K)",
  "10-Q": "Quarterly report (10-Q)",
  "20-F": "Annual report (20-F)",
  "6-K": "Foreign report (6-K)",
  "S-1": "IPO registration (S-1)",
  D: "Form D — fundraising filed",
};

interface Submissions {
  name?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      form?: string[];
      primaryDocument?: string[];
    };
  };
}

interface TickerRow {
  cik_str?: number;
  ticker?: string;
  title?: string;
}

interface CompanyRef {
  cik: string; // zero-padded to 10
  ticker: string;
  title: string;
}

export const edgarTool: GatherTool = {
  name: "edgar",
  appliesTo: (entity) =>
    Boolean(entity.company.cik) ||
    Boolean(entity.company.ticker) ||
    entity.company.isPublic,

  async run(entity: ResolvedEntity, signal: AbortSignal): Promise<RawEvidence[]> {
    const cik = await resolveCik(entity, signal);
    if (!cik) return [];

    const subs = await fetchSubmissions(cik, signal);
    if (!subs) return [];

    const recent = subs.filings?.recent;
    if (!recent?.form?.length) return [];

    const cikNum = String(Number(cik)); // un-padded, for archive URLs
    const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;
    const now = new Date().toISOString();
    const evidence: RawEvidence[] = [];

    for (let i = 0; i < recent.form.length && evidence.length < MAX_FILINGS; i++) {
      const form = recent.form[i];
      const label = NOTABLE[form];
      if (!label) continue;

      const date = recent.filingDate?.[i];
      if (date && Date.parse(date) < cutoff) continue;

      const accession = recent.accessionNumber?.[i];
      const doc = recent.primaryDocument?.[i];
      const url = filingUrl(cikNum, accession, doc);

      evidence.push({
        claim: date ? `${label}, filed ${date}.` : `${label}.`,
        sourceUrl: url,
        sourceTitle: `SEC EDGAR — ${subs.name ?? entity.company.name} (${form})`,
        retrievedAt: now,
      });
    }

    return evidence;
  },
};

async function resolveCik(
  entity: ResolvedEntity,
  signal: AbortSignal,
): Promise<string | null> {
  if (entity.company.cik) return pad(entity.company.cik);

  const table = await loadTickerTable(signal);
  if (!table) return null;

  const ticker = entity.company.ticker?.trim().toUpperCase();
  if (ticker) {
    const hit = table.find((c) => c.ticker === ticker);
    if (hit) return hit.cik;
  }

  // Match by name: exact normalised title, then a contains either way.
  const target = normName(entity.company.name);
  if (!target) return null;
  const exact = table.find((c) => normName(c.title) === target);
  if (exact) return exact.cik;
  const partial = table.find((c) => {
    const t = normName(c.title);
    return t.length > 2 && (t.startsWith(target) || target.startsWith(t));
  });
  return partial?.cik ?? null;
}

// SEC's ticker map is ~1MB and changes rarely; cache it across warm invocations.
let tickerCache: { at: number; table: CompanyRef[] } | null = null;

async function loadTickerTable(signal: AbortSignal): Promise<CompanyRef[] | null> {
  if (tickerCache && Date.now() - tickerCache.at < TICKER_TABLE_TTL_MS) {
    return tickerCache.table;
  }
  const res = await fetch(TICKERS, { signal, headers: HEADERS });
  if (!res.ok) {
    console.warn(`edgar: ticker map HTTP ${res.status}`);
    return null;
  }
  const json = (await res.json()) as Record<string, TickerRow>;
  const table: CompanyRef[] = [];
  for (const row of Object.values(json)) {
    if (row.cik_str == null || !row.ticker || !row.title) continue;
    table.push({
      cik: pad(String(row.cik_str)),
      ticker: row.ticker.toUpperCase(),
      title: row.title,
    });
  }
  tickerCache = { at: Date.now(), table };
  return table;
}

async function fetchSubmissions(
  cik: string,
  signal: AbortSignal,
): Promise<Submissions | null> {
  const res = await fetch(`${SUBMISSIONS}/CIK${cik}.json`, {
    signal,
    headers: HEADERS,
  });
  if (!res.ok) {
    console.warn(`edgar: submissions HTTP ${res.status} for CIK${cik}`);
    return null;
  }
  return (await res.json()) as Submissions;
}

/** Normalise a company name for matching: lowercase, drop legal suffix + punctuation. */
function normName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\s]+(inc|incorporated|llc|ltd|limited|corp|corporation|co|plc|gmbh|s\.?a|ag|nv)\.?$/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function filingUrl(cikNum: string, accession?: string, doc?: string): string {
  if (!accession) return `https://www.sec.gov/cgi-bin/browse-edgar?CIK=${cikNum}`;
  const noDashes = accession.replace(/-/g, "");
  const base = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${noDashes}`;
  return doc ? `${base}/${doc}` : `${base}/`;
}

function pad(cik: string): string {
  return cik.replace(/\D/g, "").padStart(10, "0");
}
