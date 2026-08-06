import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";
import { jsonHeaders as HEADERS, truncate } from "./shared";

/**
 * Wikipedia / Wikidata firmographics (#24) — always-on backbone.
 *
 * Free, no key. Search → REST summary for a company overview, plus a
 * best-effort Wikidata enrichment (founding year, ticker). Provides a reliable
 * structured base that sharpens grounding and reduces hallucination.
 *
 * **Every candidate is verified against the resolved entity before it's
 * trusted.** Wikipedia search always returns *something*: a company with no
 * English article doesn't come back empty, it comes back confidently wrong.
 * `Campus Activewear Ltd. company` yields THG plc and Target Corporation;
 * `Mamaearth` yields Shilpa Shetty. Taking the first hit with an extract meant
 * a brief could cite an unrelated company as a source — precisely the failure
 * entity resolution exists to prevent, and worse than having no source at all,
 * because it wears a citation.
 *
 * So a candidate is accepted only when its title matches the resolved company
 * name (§`articleMatchesCompany`), and it's discarded when Wikidata's official
 * website contradicts the resolved domain — the guard against a same-name
 * different-company match. No match means this tool returns nothing: the belt
 * is honestly short rather than confidently wrong.
 */

const WIKI = "https://en.wikipedia.org";

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

/** Structured facts plus the one field used to verify the entity. */
interface WikidataInfo {
  facts: string[];
  officialSite?: string;
}

export const wikipediaTool: GatherTool = {
  name: "wikipedia",
  appliesTo: () => true,

  async run(entity: ResolvedEntity, signal: AbortSignal): Promise<RawEvidence[]> {
    const titles = await searchTitles(entity.company.name, signal);
    if (titles.length === 0) return [];

    // Fetch the candidates together — verification may have to look past the
    // first few, and five REST summaries in parallel cost less wall-clock than
    // two in series against this tool's slice of the gather budget.
    const summaries = await Promise.all(
      titles.map((title) => fetchSummary(title, signal)),
    );

    // Search order is relevance order, so the first candidate that is a real
    // article *and* verifiably about this company is the best one.
    const summary =
      summaries.find(
        (s): s is WikiSummary =>
          s !== null &&
          s.type !== "disambiguation" &&
          Boolean(s.extract) &&
          articleMatchesCompany(s.title, entity.company.name),
      ) ?? null;
    if (!summary) return [];

    // Best-effort structured facts from Wikidata; failures are non-fatal.
    let info: WikidataInfo = { facts: [] };
    if (summary.wikibase_item) {
      try {
        info = await wikidataInfo(summary.wikibase_item, signal);
      } catch {
        // ignore enrichment failures
      }
    }

    // A title can match while the entity doesn't — "Campus" the German shoe
    // brand is not Campus Activewear. When both sides know a domain and they
    // disagree, trust the resolved entity and drop the article entirely.
    if (contradictsDomain(info.officialSite, entity.company.domain)) return [];

    const now = new Date().toISOString();
    const pageUrl =
      summary.content_urls?.desktop?.page ??
      `${WIKI}/wiki/${encodeURIComponent(summary.title)}`;
    const evidence: RawEvidence[] = [];

    if (summary.extract) {
      evidence.push({
        claim: truncate(summary.extract, 600),
        sourceUrl: pageUrl,
        sourceTitle: `Wikipedia — ${summary.title}`,
        retrievedAt: now,
      });
    }

    for (const fact of info.facts) {
      evidence.push({
        claim: fact,
        sourceUrl: `https://www.wikidata.org/wiki/${summary.wikibase_item}`,
        sourceTitle: `Wikidata — ${summary.title}`,
        retrievedAt: now,
      });
    }

    return evidence;
  },
};

// ── Entity verification ──────────────────────────────────────

/**
 * Legal forms and generic corporate filler. Stripped from both sides before
 * comparison so "GitLab" matches "GitLab Inc." — they carry no identifying
 * signal, and keeping them would make every `… Ltd.` look distinct.
 */
const NAME_NOISE = new Set([
  "ltd", "limited", "inc", "incorporated", "plc", "pvt", "private", "corp",
  "corporation", "llc", "llp", "co", "company", "group", "holdings", "holding",
  "sa", "nv", "bv", "gmbh", "ag", "ab", "as", "oy", "oyj", "srl", "spa", "kk",
  "pte", "sas", "the",
]);

/**
 * Identifying tokens of a name: lowercased, punctuation split out, legal forms
 * and single characters dropped. Falls back to the unfiltered tokens when
 * stripping would empty the set (a company genuinely called "The Co").
 */
function nameTokens(name: string): Set<string> {
  const all = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const distinctive = all.filter((t) => !NAME_NOISE.has(t));
  return new Set(distinctive.length > 0 ? distinctive : all);
}

/** Every token of `a` present in `b`. Empty `a` never matches. */
function isSubset(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0) return false;
  for (const token of a) if (!b.has(token)) return false;
  return true;
}

/**
 * Is this article about this company?
 *
 * True when either name's identifying tokens are contained in the other's —
 * which accepts both directions of the usual mismatch: an article titled more
 * fully than the resolved name ("GitLab" → "GitLab Inc.") and one titled by the
 * brand while resolution returned the legal entity ("FSN E-Commerce Ventures
 * Ltd. (Nykaa)" → "Nykaa"). Unrelated names share no tokens and are rejected.
 *
 * Deliberately compares titles only. Matching on the extract would re-admit the
 * bug: a long article mentions many companies, and "Campus" appears in plenty
 * of them.
 *
 * Known limit, by design: a name that is a subset of another passes here even
 * when the companies differ — "Campus" the German shoe brand against "Campus
 * Activewear". That case is indistinguishable from the legitimate
 * brand-vs-legal-entity match above, so it isn't this function's job.
 * `contradictsDomain` is the layer that catches it.
 */
export function articleMatchesCompany(
  articleTitle: string,
  companyName: string,
): boolean {
  const title = nameTokens(articleTitle);
  const company = nameTokens(companyName);
  return isSubset(title, company) || isSubset(company, title);
}

/**
 * Registrable domain — host, minus `www.`, reduced to the part that identifies
 * the owner, so `about.gitlab.com` and `gitlab.com` compare equal. Handles the
 * common compound TLDs (`.co.in`, `.co.uk`); an unknown one degrades to the
 * last two labels, which risks a false *match* and never a false rejection.
 */
export function registrableDomain(input: string): string {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  host = host.split("/")[0].split("?")[0].split("#")[0];
  host = host.split("@").pop() ?? host; // userinfo
  host = host.split(":")[0]; // port
  host = host.replace(/^www\./, "");

  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");

  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const compound = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);
  const keep = tld.length === 2 && compound.has(sld) ? 3 : 2;
  return parts.slice(-keep).join(".");
}

/**
 * Only a *positive* contradiction rejects — both sides must know a domain and
 * disagree. A missing official website is the common case, not evidence of a
 * mismatch, so absence always passes.
 */
export function contradictsDomain(
  officialSite: string | undefined,
  resolvedDomain: string | undefined,
): boolean {
  if (!officialSite || !resolvedDomain) return false;
  const a = registrableDomain(officialSite);
  const b = registrableDomain(resolvedDomain);
  if (!a || !b) return false;
  return a !== b;
}

// ── Fetching ─────────────────────────────────────────────────

async function searchTitles(
  company: string,
  signal: AbortSignal,
): Promise<string[]> {
  // Search the name without its legal form — "Campus Activewear Ltd. company"
  // reads as three competing hints and ranks worse than "Campus Activewear
  // company". The trailing hint still biases toward the organisation.
  const query = `${[...nameTokens(company)].join(" ")} company`;
  const url =
    `${WIKI}/w/api.php?action=query&format=json&list=search&srlimit=5&srprop=` +
    `&srsearch=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) return [];
  const json = (await res.json()) as WikiSearchResponse;
  return (json.query?.search ?? []).map((s) => s.title);
}

async function fetchSummary(
  title: string,
  signal: AbortSignal,
): Promise<WikiSummary | null> {
  const url = `${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url, { signal, headers: HEADERS });
    if (!res.ok) return null;
    return (await res.json()) as WikiSummary;
  } catch {
    // One bad candidate must not fail the whole batch.
    return null;
  }
}

async function wikidataInfo(
  qid: string,
  signal: AbortSignal,
): Promise<WikidataInfo> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) return { facts: [] };
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

  // P856 — official website (string). Verification only, never a claim.
  const site = claims.P856?.[0]?.mainsnak?.datavalue?.value;

  return {
    facts,
    officialSite: typeof site === "string" ? site : undefined,
  };
}

function inceptionYear(value: unknown): string | null {
  if (value && typeof value === "object" && "time" in value) {
    const time = (value as { time?: string }).time;
    const match = time?.match(/^\+?(\d{4})/);
    if (match) return match[1];
  }
  return null;
}
