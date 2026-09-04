import type { BriefResult } from "@/types/brief";
import { BriefResultView } from "@/components/brief-result";
import { BriefActions } from "@/components/brief-actions";
import { BriefFollowUps } from "@/components/brief-followups";

/**
 * A brief plus its conversation: the pinned brief artifact, export actions, and
 * the grounded follow-up panel. Shared between the inline studio view and the
 * focused full-page view so both stay identical. The follow-ups are keyed to the
 * brief so switching briefs starts a fresh conversation.
 *
 * Closing and expanding are the brief window's own chrome lights, so each view
 * just says which of them mean anything here.
 */
export function BriefConversation({
  result,
  onClose,
  onExpand,
  briefId,
  conversationId,
}: {
  result: BriefResult;
  onClose?: () => void;
  onExpand?: () => void;
  /** Account id of this brief, when it has one. Only a brief the account holds
   *  can resolve its attachment sources (#99); everything else renders them as
   *  plain labels. */
  briefId?: string | null;
  /** Set when this brief was just generated here, so its follow-ups join the
   *  same Langfuse session as the generation (#15). Absent for a brief opened
   *  from history — that's a new conversation, and the panel opens one. */
  conversationId?: string | null;
}) {
  return (
    <div className="space-y-4">
      <BriefResultView
        result={result}
        onClose={onClose}
        onExpand={onExpand}
        briefId={briefId}
      />
      <BriefActions result={result} />
      <BriefFollowUps
        key={result.meta.generatedAt}
        result={result}
        briefId={briefId}
        conversationId={conversationId}
      />
    </div>
  );
}
