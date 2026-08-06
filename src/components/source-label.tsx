import type { Evidence } from "@/types/brief";
import { attachmentRefOf, isLinkedEvidence } from "@/lib/evidence-source";

const LINK =
  "text-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-ivory";

/**
 * A single entry in a Sources list.
 *
 * Public evidence links straight out. An attachment (#99) can't: its locator is
 * `attachment://<ref>`, deliberately not a URL, because a signed URL expires
 * and a saved brief doesn't. So it resolves through `/api/attachments`, which
 * checks the caller owns this brief and mints a fresh link per click.
 *
 * That only works for a brief the account actually holds, so `briefId` is the
 * switch: with one, the source opens; without one — an unsaved brief, a
 * signed-out visitor, a deployment with no bucket — it stays a labelled,
 * unlinked title. A brief whose whole claim is that sources are checkable can
 * afford a source that says "you attached this"; it cannot afford one that
 * looks clickable and isn't.
 */
export function SourceLabel({
  evidence,
  briefId,
}: {
  evidence: Evidence;
  /** The account id of the brief being rendered, when it has one. */
  briefId?: string | null;
}) {
  if (isLinkedEvidence(evidence.sourceUrl)) {
    return (
      <a href={evidence.sourceUrl} target="_blank" rel="noreferrer" className={LINK}>
        {evidence.sourceTitle}
      </a>
    );
  }

  const ref = attachmentRefOf(evidence.sourceUrl);
  if (briefId && ref) {
    return (
      <a
        href={`/api/attachments/${encodeURIComponent(briefId)}/${encodeURIComponent(ref)}`}
        target="_blank"
        rel="noreferrer"
        title="Open the document you attached"
        className={LINK}
      >
        {evidence.sourceTitle}
      </a>
    );
  }

  return (
    <span
      title="From a document you attached"
      className="cursor-default text-muted underline decoration-line-strong decoration-dotted underline-offset-2"
    >
      {evidence.sourceTitle}
    </span>
  );
}
