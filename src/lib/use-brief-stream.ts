"use client";

import { useState } from "react";
import type {
  BriefInput,
  BriefResult,
  BriefStage,
  BriefStreamMessage,
} from "@/types/brief";
import { getSessionId } from "@/lib/session-id";
import { saveToHistory } from "@/lib/brief-history";

export type GenStatus = "idle" | "loading" | "done" | "error";

/** sessionStorage key the studio uses to hand a pending BriefInput to the
 *  focused page (`/brief/new`), which then streams the generation there. */
export const PENDING_BRIEF_KEY = "argus.pending-brief";

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

  async function run(input: BriefInput, onResult?: (r: BriefResult) => void) {
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
        body: JSON.stringify(input),
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
            onResult?.(msg.result);
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
