import type { Evidence } from "@/types/brief";

/**
 * Where a piece of evidence came from, as far as the *reader* is concerned.
 *
 * Every gather tool produces a public `https://` source the rep can click
 * through to. Attachments (#99) cannot: the document was supplied for one
 * request and never stored, so there is nothing to link to. Rendering it as a
 * link anyway would be worse than not linking at all — a dead href in a brief
 * whose entire promise is "every claim is checkable" reads as a broken claim.
 *
 * So the locator carries its own scheme (`attachment://…`) and the UI branches
 * on it. This is deliberately a *derived* property rather than a field on
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
