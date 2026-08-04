import type { BriefInput, Evidence, ResolvedEntity } from "@/types/brief";

/**
 * The demo scenario — one scripted account, used when demo mode is on.
 *
 * Demo mode exists so ARGUS can be shown end to end without depending on live
 * networks: entity resolution and the gather tool belt are replaced by the
 * fixed entity + evidence below, while **synthesis is still a real LLM call**.
 * The brief an investor watches being written is genuinely generated — it is
 * just grounded in a known evidence store, so the run is fast, free of
 * third-party rate limits, and identical every time.
 *
 * The evidence is a hand-curated snapshot of real public sources (every URL
 * resolves — click-through survives a live demo). Figures are point-in-time as
 * of `RETRIEVED_AT` and are not refreshed; treat this file as demo data, never
 * as a source of truth about the company.
 */

/** When this snapshot was taken — surfaced as each source's retrieval time. */
const RETRIEVED_AT = "2026-07-28T09:12:00.000Z";

/** The buyer contact is fictional; the company and its sources are real. */
export const DEMO_INPUT: BriefInput = {
  company: "Snowflake",
  person: "Dana Whitfield",
  context: "Renewal + platform expansion review ahead of their Q3 planning",
  meetingType: "renewal",
  seller: {
    company: "Cobalt Systems",
    offering:
      "warehouse cost observability — per-query spend attribution and idle-warehouse detection for Snowflake and Databricks",
    valueProp:
      "cut warehouse spend 20–30% without slowing analytics teams down",
    competitors: ["Monte Carlo", "Select Star"],
  },
};

export const DEMO_ENTITY: ResolvedEntity = {
  company: {
    name: "Snowflake Inc.",
    domain: "snowflake.com",
    industry: "Cloud data platform",
    isPublic: true,
    ticker: "SNOW",
    cik: "0001640147",
    jobBoardSlug: "snowflake",
  },
  person: { name: "Dana Whitfield", role: "VP, Data Platform Engineering" },
  confidence: 0.96,
  candidates: [],
};

export const DEMO_EVIDENCE: Evidence[] = [
  {
    id: "e1",
    claim:
      "Fiscal-year product revenue of $3.46B, up 29% year over year (FY ended January 31, 2025).",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001640147&type=10-K",
    sourceTitle: "Snowflake Inc. — annual report (10-K), SEC EDGAR",
    tool: "edgar",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e2",
    claim:
      "Remaining performance obligations of $6.9B, up 33% year over year — a large contracted backlog ahead of renewals.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001640147&type=10-Q",
    sourceTitle: "Snowflake Inc. — quarterly report (10-Q), SEC EDGAR",
    tool: "edgar",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e3",
    claim:
      "Management guidance flagged elevated GPU and AI-infrastructure spend compressing product gross margin.",
    sourceUrl: "https://investors.snowflake.com/quarterly-results/",
    sourceTitle: "Snowflake investor relations — quarterly results",
    tool: "financials",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e4",
    claim:
      "Publicly traded on the NYSE under the ticker SNOW; consumption-based revenue model reported quarterly.",
    sourceUrl: "https://finance.yahoo.com/quote/SNOW/",
    sourceTitle: "SNOW — market data",
    tool: "financials",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e5",
    claim:
      "Founded in 2012; a cloud data platform that separates storage from compute across AWS, Azure and Google Cloud.",
    sourceUrl: "https://en.wikipedia.org/wiki/Snowflake_Inc.",
    sourceTitle: "Snowflake Inc. — Wikipedia",
    tool: "wikipedia",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e6",
    claim:
      "17 open roles in data-platform and FinOps engineering, including a “Staff Engineer, Warehouse Efficiency”.",
    sourceUrl: "https://careers.snowflake.com/us/en/search-results",
    sourceTitle: "Snowflake careers — open roles",
    tool: "jobboards",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e7",
    claim:
      "Product pages now lead with cost governance — budgets, resource monitors and per-warehouse spend controls.",
    sourceUrl: "https://www.snowflake.com/en/product/",
    sourceTitle: "Snowflake — product overview",
    tool: "website",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e8",
    claim:
      "Newsroom coverage of their annual summit paired AI workload launches with customer pressure on compute cost.",
    sourceUrl: "https://investors.snowflake.com/news/",
    sourceTitle: "Snowflake newsroom",
    tool: "gdelt",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e9",
    claim:
      "The snowflakedb GitHub org maintains the official connectors and Snowpark tooling, with heavy recent CLI activity.",
    sourceUrl: "https://github.com/snowflakedb",
    sourceTitle: "snowflakedb on GitHub",
    tool: "github",
    retrievedAt: RETRIEVED_AT,
  },
];

/** The tool names the scripted evidence spans — shown as the demo's source belt. */
export const DEMO_TOOLS = [...new Set(DEMO_EVIDENCE.map((e) => e.tool))];

/**
 * How long to hold each pre-synthesis stage. The real resolve + gather steps are
 * skipped, but the loader still walks its stages so the pipeline reads honestly
 * on screen; synthesis afterwards takes however long the model takes.
 */
export const DEMO_STAGE_MS = { resolving: 700, gathering: 1500 } as const;
