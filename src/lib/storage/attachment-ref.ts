import { createHash } from "node:crypto";
import type { Attachment } from "@/types/brief";

/**
 * The identifier that ties a piece of evidence to the document it came from.
 *
 * It appears in the evidence locator (`attachment://<ref>`) written during
 * extraction, and again as the object name when the file is stored — which is
 * what lets a saved brief resolve its own sources without carrying a URL that
 * can expire.
 *
 * Content-derived rather than positional, so the same file attached twice
 * collapses through the existing `sourceUrl + claim` dedupe instead of
 * doubling the Sources list. It is a fingerprint, not a handle: nothing can be
 * fetched with it alone — the resolver still checks the caller owns a brief
 * that cites it.
 *
 * Lives in its own module so both the extractor and the save route can compute
 * it without either pulling in the other's dependencies.
 */
export function attachmentRef(attachment: Attachment): string {
  // Length-framed, not concatenated. Hashing `name + data` directly leaves the
  // boundary ambiguous — ("a", "QUJDREVG") and ("aQUJD", "REVG") feed the hash
  // identical bytes — so two different documents would land on one object path
  // and silently overwrite each other. Prefixing the name's length makes the
  // split unambiguous, and does it without building a second multi-megabyte
  // string the way JSON-encoding the pair would.
  return createHash("sha256")
    .update(`${attachment.name.length}:`)
    .update(attachment.name)
    .update(attachment.data)
    .digest("hex")
    .slice(0, 12);
}
