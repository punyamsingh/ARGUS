import type { ResolvedEntity } from "@/types/brief";
import type { GatherTool, RawEvidence } from "./types";

/**
 * Financial markets (#29) — market-level signal for public-company prospects.
 *
 * Uses Finnhub's free tier (set `FINNHUB_API_KEY`). Given a ticker, fetches the
 * latest quote (recent price move) and the next earnings date, turned into cited
 * evidence. Runs only when a ticker is known and a key is configured; private /
 * no-ticker / no-key all no-op cleanly. Sources cite the human-viewable Yahoo
 * Finance quote page so claims are verifiable.
 */

const API = "https://finnhub.io/api/v1";
const HEADERS = { Accept: "application/json" };
const EARNINGS_LOOKAHEAD_DAYS = 120;

interface Quote {
  c?: number; // current price
  d?: number; // change
  dp?: number; // percent change
  pc?: number; // previous close
}

interface EarningsResponse {
  earningsCalendar?: { date?: string; symbol?: string }[];
}

export const financialsTool: GatherTool = {
  name: "financials",
  appliesTo: (entity) =>
    Boolean(entity.company.ticker) && Boolean(process.env.FINNHUB_API_KEY),

  async run(entity: ResolvedEntity, signal: AbortSignal): Promise<RawEvidence[]> {
    const token = process.env.FINNHUB_API_KEY;
    const ticker = entity.company.ticker?.trim().toUpperCase();
    if (!token || !ticker) return [];

    const now = new Date();
    const retrievedAt = now.toISOString();
    const source = `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`;
    const evidence: RawEvidence[] = [];

    const [quote, earnings] = await Promise.all([
      fetchQuote(ticker, token, signal).catch(() => null),
      nextEarningsDate(ticker, token, now, signal).catch(() => null),
    ]);

    if (quote && typeof quote.c === "number" && quote.c > 0) {
      const dp = quote.dp ?? 0;
      const dir = dp > 0 ? "up" : dp < 0 ? "down" : "flat";
      const move =
        dir === "flat"
          ? "flat on the day"
          : `${dir} ${Math.abs(dp).toFixed(1)}% on the day`;
      const prev =
        typeof quote.pc === "number" ? ` (prev close $${quote.pc.toFixed(2)})` : "";
      evidence.push({
        claim: `${ticker} stock: $${quote.c.toFixed(2)}, ${move}${prev}.`,
        sourceUrl: source,
        sourceTitle: `${ticker} — market quote (Finnhub)`,
        retrievedAt,
      });
    }

    if (earnings) {
      evidence.push({
        claim: `Next earnings for ${ticker} expected around ${earnings}.`,
        sourceUrl: source,
        sourceTitle: `${ticker} — earnings calendar (Finnhub)`,
        retrievedAt,
      });
    }

    return evidence;
  },
};

async function fetchQuote(
  ticker: string,
  token: string,
  signal: AbortSignal,
): Promise<Quote | null> {
  const url = `${API}/quote?symbol=${encodeURIComponent(ticker)}&token=${token}`;
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) {
    console.warn(`financials: quote HTTP ${res.status} for ${ticker}`);
    return null;
  }
  return (await res.json()) as Quote;
}

/** Soonest earnings date within the lookahead window, if the plan exposes it. */
async function nextEarningsDate(
  ticker: string,
  token: string,
  now: Date,
  signal: AbortSignal,
): Promise<string | null> {
  const to = new Date(now.getTime() + EARNINGS_LOOKAHEAD_DAYS * 86_400_000);
  const url =
    `${API}/calendar/earnings?symbol=${encodeURIComponent(ticker)}` +
    `&from=${isoDate(now)}&to=${isoDate(to)}&token=${token}`;
  const res = await fetch(url, { signal, headers: HEADERS });
  if (!res.ok) {
    // Earnings calendar isn't on every free plan — treat as "no data".
    return null;
  }
  const json = (await res.json()) as EarningsResponse;
  const dates = (json.earningsCalendar ?? [])
    .map((e) => e.date)
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates[0] ?? null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
