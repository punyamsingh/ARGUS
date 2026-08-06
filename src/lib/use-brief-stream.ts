"use client";

import { useState } from "react";
import type {
  Attachment,
  BriefInput,
  BriefResult,
  BriefStage,
  BriefStreamMessage,
} from "@/types/brief";
import { getSessionId } from "@/lib/session-id";
import { saveToHistory } from "@/lib/brief-history";
import { saveBriefToAccount } from "@/lib/briefs/library";

export type GenStatus = "idle" | "loading" | "done" | "error";

/** sessionStorage key the studio uses to hand a pending BriefInput to the
 *  focused page (`/brief/new`), which then streams the generation there. */
export const PENDING_BRIEF_KEY = "argus.pending-brief";

/** What the studio stashes under that key: the input plus the demo flag that
 *  was in effect when Generate was pressed. Attachments (#99) are deliberately
 *  absent — they hand over in memory instead (see `lib/attachments-client.ts`),
 *  so nothing the rep uploads is written to browser storage either. */
export type PendingBrief = { input: BriefInput; demo?: boolean };

/** Read a stashed pending brief, tolerating the older bare-`BriefInput` shape. */
export function parsePendingBrief(raw: string): PendingBrief | null {
  try {
    const parsed = JSON.parse(raw) as PendingBrief | BriefInput;
    if (parsed && typeof parsed === "object" && "input" in parsed) {
      return parsed as PendingBrief;
    }
    return { input: parsed as BriefInput };
  } catch {
    return null;
  }
}

/**
 * Drives a brief generation: POSTs to /api/brief, consumes the streamed NDJSON
 * (stage events → terminal result/error), persists the result to history, and
 * exposes the live state. Extracted so the focused brief page can stream a brief
 * the moment you land on it.
 */
export function useBriefStream() {
  const [status, setStatus] = useState<GenStatus>("idle");
  const [stage, setStage] = useState<BriefStage>("resolving");
  const [result, setResult] = useState<BriefResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    input: BriefInput,
    /** `savedId` is the brief's id in the signed-in user's account, or null when
     *  it wasn't saved there (signed out, demo, or the write failed). */
    onResult?: (r: BriefResult, savedId: string | null) => void,
    {
      demo = false,
      attachments = [],
    }: { demo?: boolean; attachments?: Attachment[] } = {},
  ) {
    setStatus("loading");
    setStage("resolving");
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The route streams NDJSON; ask for it explicitly so the contract is
          // unambiguous and a future JSON fallback wouldn't desync the reader.
          Accept: "application/x-ndjson, application/json",
          // Groups this browser's briefs into one Langfuse session.
          "x-argus-session-id": getSessionId(),
        },
        // `demo` and `attachments` ride alongside the input — the route reads
        // them separately, so the BriefInput contract is untouched. For
        // attachments that separation is load-bearing: it's what keeps them out
        // of the saved brief and out of follow-up requests (#99).
        body: JSON.stringify({
          ...input,
          ...(demo ? { demo: true } : {}),
          ...(attachments.length ? { attachments } : {}),
        }),
      });

      // Validation failures come back as a plain JSON error (4xx).
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let settled = false;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;

          const msg = JSON.parse(line) as BriefStreamMessage;
          if (msg.type === "stage") {
            setStage(msg.stage);
          } else if (msg.type === "result") {
            setResult(msg.result);
            saveToHistory(msg.result);
            setStatus("done");
            settled = true;

            // Then persist to the account, if there is one. `saveBriefToAccount`
            // never throws — signed out, demo mode, and a failed request all
            // come back as null — so the rendered brief is never at risk. It's
            // awaited only so `onResult` receives the server id: that's what
            // /brief/<id> resolves from another device, and getting the URL
            // right the first time beats swapping it twice.
            // The same documents that fed the brief are retained beside it —
            // only here, once there's an account row to own them (#99).
            const savedId = await saveBriefToAccount(msg.result, attachments);
            onResult?.(msg.result, savedId);
          } else {
            throw new Error(msg.error);
          }
        }
      }

      if (!settled) {
        throw new Error("The brief ended unexpectedly. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return { status, stage, result, error, run };
}
