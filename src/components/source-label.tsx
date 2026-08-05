import type { Evidence } from "@/types/brief";
import { isLinkedEvidence } from "@/lib/evidence-source";

/**
 * A single entry in a Sources list.
 *
 * Public evidence links out. Evidence drawn from a rep-supplied attachment
 * (#99) has nowhere to link to — the document was read for one request and
 * never stored — so it renders as a labelled, unlinked title instead. The
 * dotted underline keeps it visually parallel to its neighbours while making
 * clear there's nothing to click, which matters in a brief whose whole claim is
 * that every source is checkable: a dead link would read as a broken one.
 */
export function SourceLabel({ evidence }: { evidence: Evidence }) {
  if (!isLinkedEvidence(evidence.sourceUrl)) {
    return (
      <span
        title="From a document you attached — not stored"
        className="cursor-default text-muted underline decoration-line-strong decoration-dotted underline-offset-2"
      >
        {evidence.sourceTitle}
      </span>
    );
  }

  return (
    <a
      href={evidence.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="text-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-ivory"
    >
      {evidence.sourceTitle}
    </a>
  );
}
