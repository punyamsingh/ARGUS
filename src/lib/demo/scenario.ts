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
 *
 * Note on the tool belt: Nykaa files with the NSE and BSE, not the SEC, so the
 * `edgar` tool has nothing to say about it and no evidence here claims to come
 * from one. That gap is real — an Indian-listings tool is not built yet — and
 * the demo shows the belt honestly short rather than inventing a source.
 */

/** When this snapshot was taken — surfaced as each source's retrieval time. */
const RETRIEVED_AT = "2026-07-30T09:12:00.000Z";

/**
 * The buyer contact and the selling company are fictional; the company being
 * researched and every source below are real. `person` is deliberately not any
 * of Nykaa's actual named executives.
 */
export const DEMO_INPUT: BriefInput = {
  company: "Nykaa",
  person: "Ananya Deshmukh",
  context:
    "Renewal + expansion review ahead of their festive quarter and FY27 fulfilment plan",
  meetingType: "renewal",
  seller: {
    company: "Lekha Systems",
    offering:
      "fulfilment cost observability for omnichannel retail — per-order margin attribution and return-reason detection across warehouses, stores and rapid-delivery hubs",
    valueProp:
      "recover 3–5 points of contribution margin per order without slowing delivery promises",
    competitors: ["Increff", "Unicommerce"],
  },
};

export const DEMO_ENTITY: ResolvedEntity = {
  company: {
    name: "FSN E-Commerce Ventures Ltd. (Nykaa)",
    domain: "nykaa.com",
    industry: "Beauty, fashion & lifestyle e-commerce",
    isPublic: true,
    ticker: "NYKAA",
    jobBoardSlug: "nykaa",
  },
  person: {
    name: "Ananya Deshmukh",
    role: "VP, Fulfilment & Retail Technology",
  },
  confidence: 0.96,
  candidates: [],
};

export const DEMO_EVIDENCE: Evidence[] = [
  {
    id: "e1",
    claim:
      "FY26 revenue from operations of ₹10,022 crore, up 26% year over year — the first year past the $1 billion mark (FY ended March 31, 2026).",
    sourceUrl: "https://www.nykaa.com/investor-relations",
    sourceTitle: "FSN E-Commerce Ventures (Nykaa) — investor relations",
    tool: "financials",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e2",
    claim:
      "FY26 GMV of ₹19,963 crore, up 28%, with EBITDA margin expanding to 7.5% from 6.0% a year earlier — growth and margin moving together.",
    sourceUrl:
      "https://www.nykaa.com/media/wysiwyg/uiTools/2026-5/Investor-Presentation-Q4-2026.pdf",
    sourceTitle: "Nykaa — investor presentation, Q4 & FY26",
    tool: "financials",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e3",
    claim:
      "Publicly listed on the NSE and BSE under the ticker NYKAA; GMV, net revenue and segment margin are reported quarterly for Beauty and Fashion separately.",
    sourceUrl: "https://finance.yahoo.com/quote/NYKAA.NS/",
    sourceTitle: "NYKAA.NS — market data",
    tool: "financials",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e4",
    claim:
      "Founded in 2012 by Falguni Nayar and headquartered in Mumbai; began in beauty and expanded into fashion, men's and an eB2B distribution arm.",
    sourceUrl: "https://en.wikipedia.org/wiki/Nykaa",
    sourceTitle: "Nykaa — Wikipedia",
    tool: "wikipedia",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e5",
    claim:
      "Runs several platforms off one operation — Nykaa Fashion, Nykaa Man and the Superstore eB2B business — alongside a house of owned brands.",
    sourceUrl: "https://www.nykaa.com/who_are_we",
    sourceTitle: "Nykaa — who we are",
    tool: "website",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e6",
    claim:
      "FY26 coverage led with the $1 billion revenue milestone and a profit surge, with net profit up 183% year over year to ₹204 crore.",
    sourceUrl:
      "https://www.indianretailer.com/news/retail-india-news-nykaa-crosses-1-bn-revenue-mark-fy26-profit-surges",
    sourceTitle: "Nykaa crosses $1bn revenue mark in FY26 — Indian Retailer",
    tool: "gdelt",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e7",
    claim:
      "Omnichannel footprint now spans 313 stores across 99 cities and 44 warehouses across 15 cities, plus a two-hour rapid-delivery network (Nykaa Now).",
    sourceUrl:
      "https://thestrategystory.com/blog/nykaa-business-strategy-in-2026-growth-strategy-ai-omnichannel-expansion/",
    sourceTitle: "Nykaa business strategy 2026 — omnichannel expansion",
    tool: "gdelt",
    retrievedAt: RETRIEVED_AT,
  },
  {
    id: "e8",
    claim:
      "Careers site is hiring across technology, supply chain and retail operations, including warehouse and last-mile roles.",
    sourceUrl: "https://careers.nykaa.com/",
    sourceTitle: "Nykaa careers — open roles",
    tool: "jobboards",
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
