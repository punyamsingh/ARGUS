/**
 * Shared helpers for the gather tool belt (#24–#31).
 *
 * Every tool is a read-only fetcher that turns a third-party response into
 * `RawEvidence`. The polite User-Agent, header shapes, claim truncation, and
 * company-name / domain normalisation below were copy-pasted across the tools;
 * centralising them keeps each tool focused on its own API quirks and the
 * shared conventions in one place.
 */

/** Polite, identifiable User-Agent sent on outbound tool requests. */
export const ARGUS_UA = "ARGUS/0.1 (+https://github.com/punyamsingh/ARGUS)";

/** Headers for a JSON API request. */
export const jsonHeaders: Record<string, string> = {
  "User-Agent": ARGUS_UA,
  Accept: "application/json",
};

/** Headers for an HTML page fetch. */
export const htmlHeaders: Record<string, string> = {
  "User-Agent": ARGUS_UA,
  Accept: "text/html,application/xhtml+xml",
};

/** Default cap on an evidence claim's length. */
export const CLAIM_MAX = 400;

/** Truncate to `max` chars, trimming and appending an ellipsis when cut. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

const LEGAL_SUFFIX_RE =
  /[,\s]+(inc|incorporated|llc|ltd|limited|corp|corporation|co|plc|gmbh|s\.?a|ag|nv)\.?$/i;

/** Drop a trailing legal suffix (Inc., LLC, Ltd, …) from a company name. */
export function stripLegalSuffix(name: string): string {
  return name.replace(LEGAL_SUFFIX_RE, "").trim();
}

/** Strip protocol and path from a domain/URL, leaving the bare host (or null). */
export function bareHost(domain?: string | null): string | null {
  if (!domain) return null;
  const host = domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
  return host || null;
}
