import type { BriefResult } from "@/types/brief";
import { BriefResultView } from "@/components/brief-result";
import { BriefActions } from "@/components/brief-actions";
import { BriefFollowUps } from "@/components/brief-followups";

/**
 * A brief plus its conversation: the pinned brief artifact, export actions, and
 * the grounded follow-up panel. Shared between the inline studio view and the
 * focused full-page view so both stay identical. The follow-ups are keyed to the
 * brief so switching briefs starts a fresh conversation.
 */
export function BriefConversation({ result }: { result: BriefResult }) {
  return (
    <div className="space-y-4">
      <BriefResultView result={result} />
      <BriefActions result={result} />
      <BriefFollowUps key={result.meta.generatedAt} result={result} />
    </div>
  );
}
