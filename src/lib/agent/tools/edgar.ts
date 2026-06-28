import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";

/**
 * SEC EDGAR (#27) — free, official-grade filings.
 *
 * Resolves the company to a CIK (preferring a CIK/ticker from entity resolution,
 * falling back to EDGAR full-text search by name — which also catches private
 * Form-D filers), then reads the submissions feed for recent notable filings:
 *  - 8-K   → material events (risk)
 *  - Form D → private fundraising (buying signal almost nobody surfaces)
 *  - 10-K / 10-Q / 20-F / 6-K → financial reports
 *  - S-1   → IPO registration
 *
 * No company / no CIK → empty, never an error. Honours SEC fair-access: a
 * declared User-Agent and a tight, capped set of requests.
 */

const SUBMISSIONS = "https://data.sec.gov/submissions";
const FTS = "https://efts.sec.gov/LATEST/search-index";
// SEC fair-access requires a User-Agent that identifies the requester AND
// includes a contact email — without one, requests get HTTP 403. Override with
// EDGAR_USER_AGENT in the environment to use a real contact; the default uses a
// non-personal GitHub no-reply address.
const HEADERS = {
  "User-Agent":
    process.env.EDGAR_USER_AGENT ??
    "ARGUS/0.1 (https://github.com/punyamsingh/ARGUS; contact: argus-agent@users.noreply.github.com)",
  Accept: "application/json",
};

const WINDOW_DAYS = 400;
const MAX_FILINGS = 6;

// Forms we surface, in priority order, with how to describe them.
const NOTABLE: Record<string, string> = {
  "8-K": "Material event (8-K)",
  D: "Form D — private fundraising filed",
  "10-K": "Annual report (10-K)",
  "10-Q": "Quarterly report (10-Q)",
  "20-F": "Annual report (20-F)",
  "6-K": "Foreign report (6-K)",
  "S-1": "IPO registration (S-1)",
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

interface FtsResponse {
  hits?: { hits?: { _source?: { display_names?: string[] } }[] };
}

export const edgarTool: GatherTool = {
  name: "edgar",
  appliesTo: (entity) => Boolean(entity.company.name),

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

  // Full-text search by name; the top hit's filer is the company. Works for
  // private Form-D filers that aren't in the ticker map.
  try {
    const url = `${FTS}?q=${encodeURIComponent(`"${entity.company.name}"`)}`;
    const res = await fetch(url, { signal, headers: HEADERS });
    if (!res.ok) {
      console.warn(`edgar: FTS HTTP ${res.status} for ${entity.company.name}`);
      return null;
    }
    const json = (await res.json()) as FtsResponse;
    for (const hit of json.hits?.hits ?? []) {
      const cik = cikFromDisplayNames(hit._source?.display_names);
      if (cik) return cik;
    }
    return null;
  } catch (err) {
    console.warn(`edgar: FTS failed — ${err instanceof Error ? err.message : err}`);
    return null;
  }
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

/** "Stripe, Inc. (CIK 0001640101)" → "0001640101". */
function cikFromDisplayNames(names?: string[]): string | null {
  for (const name of names ?? []) {
    const m = name.match(/CIK\s*(\d{10})/i);
    if (m) return m[1];
  }
  return null;
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
