import type { Evidence } from "@/types/brief";

/**
 * Where a piece of evidence came from, as far as the *reader* is concerned.
 *
 * Every gather tool produces a public `https://` source the rep can click
 * through to. An attachment (#99) can't be one: the document is private, and
 * the only URL that would reach it is a signed one that expires long before the
 * brief citing it does. Baking that into stored JSON would mean every saved
 * brief's sources quietly stopped working.
 *
 * So the locator carries its own scheme (`attachment://<ref>`) and stays
 * stable; the UI branches on it and resolves through `/api/attachments`, which
 * re-signs per click. Deliberately a *derived* property rather than a field on
 * `evidenceSchema`: adding a discriminator would have meant a contract change,
 * a migration for every saved brief, and a second thing that could disagree
 * with the URL. The scheme is already the truth.
 */

/** The locator scheme for evidence drawn from a rep-supplied attachment. */
export const ATTACHMENT_SCHEME = "attachment:";

/**
 * True when the source can be opened in a browser — i.e. it's a real public
 * link and should render as an anchor.
 *
 * Tested with a prefix match rather than `new URL()` so a malformed locator
 * degrades to "not linkable" instead of throwing inside a render.
 */
export function isLinkedEvidence(sourceUrl: string): boolean {
  return /^https?:\/\//i.test(sourceUrl);
}

/** True when this evidence came from a document the rep attached. */
export function isAttachmentEvidence(evidence: Evidence): boolean {
  return evidence.sourceUrl.toLowerCase().startsWith(ATTACHMENT_SCHEME);
}

/**
 * What a valid document reference looks like: a lowercase hex slice of a
 * digest.
 *
 * Exported so the parser here and the retrieval route enforce one rule rather
 * than two that can drift. Deliberately **case-sensitive**, matching what
 * `attachmentRef()` emits. Accepting `ABC123` and lowercasing it would quietly
 * treat two distinct locators as the same document and could serve the wrong
 * file under a cited source — in a brief that claims every source is checkable,
 * the wrong document is worse than none. So an uppercase ref is not normalised,
 * it's rejected, and the source stays an unlinked label.
 */
export const ATTACHMENT_REF_PATTERN = /^[a-f0-9]{6,64}$/;

/**
 * The document reference inside an attachment locator, or null for any other
 * source. `attachment://a1b2c3#p.%204` → `a1b2c3`.
 *
 * Parsed by hand rather than with `new URL()`: the scheme isn't special-cased
 * by the URL parser, host parsing lowercases and would silently mangle a
 * mixed-case ref, and a malformed locator here should yield null rather than
 * throw inside a render.
 */
export function attachmentRefOf(sourceUrl: string): string | null {
  if (!sourceUrl.toLowerCase().startsWith(`${ATTACHMENT_SCHEME}//`)) return null;
  const rest = sourceUrl.slice(ATTACHMENT_SCHEME.length + 2);
  const ref = rest.split("#")[0];
  return ATTACHMENT_REF_PATTERN.test(ref) ? ref : null;
}
