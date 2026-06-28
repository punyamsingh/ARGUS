"use client";

import { useRef, useState } from "react";
import type {
  AskResult,
  AskStage,
  AskStreamMessage,
  BriefResult,
} from "@/types/brief";
import { clsx } from "@/lib/cn";
import { getSessionId } from "@/lib/session-id";

/**
 * The conversational layer (#75). The brief stays the pinned hero artifact above;
 * this sits beneath it as an "ask about this meeting" affordance — NOT a chat
 * transcript that buries the brief. Each follow-up is answered by /api/brief/ask
 * (#74), grounded in the brief's evidence (or freshly gathered), and rendered
 * with the same citation discipline: source chips when supported, an honest
 * "no public signal" when not — never an uncited guess.
 */

type Turn = {
  id: number;
  question: string;
  status: "loading" | "done" | "error";
  stage: AskStage;
  result?: AskResult;
  error?: string;
};

const STAGE_LABEL: Record<AskStage, string> = {
  thinking: "Checking the brief's evidence…",
  gathering: "Searching for fresh signals…",
};

const SUGGESTIONS = [
  "What's their single biggest risk?",
  "Draft me an opener.",
  "Who else should be in the room?",
];

export function BriefFollowUps({ result }: { result: BriefResult }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);

  async function ask(raw: string) {
    const q = raw.trim();
    if (!q || busy) return;
    const id = nextId.current++;
    setQuestion("");
    setBusy(true);
    setTurns((t) => [...t, { id, question: q, status: "loading", stage: "thinking" }]);

    const update = (patch: Partial<Turn>) =>
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));

    try {
      const res = await fetch("/api/brief/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson, application/json",
          "x-argus-session-id": getSessionId(),
        },
        body: JSON.stringify({
          question: q,
          input: result.input,
          entity: result.entity,
          evidence: result.evidence,
        }),
      });

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

        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          const msg = JSON.parse(line) as AskStreamMessage;
          if (msg.type === "stage") {
            update({ stage: msg.stage });
          } else if (msg.type === "result") {
            update({ status: "done", result: msg.result });
            settled = true;
          } else {
            throw new Error(msg.error);
          }
        }
      }

      if (!settled) throw new Error("The answer ended unexpectedly. Please try again.");
    } catch (err) {
      update({
        status: "error",
        error: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line-strong bg-surface/60 print:hidden">
      <div className="border-b border-line px-5 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          Ask about this meeting
        </p>
      </div>

      {turns.length > 0 && (
        <ul className="divide-y divide-line">
          {turns.map((t) => (
            <li key={t.id} className="px-5 py-4">
              <p className="text-[13px] font-medium text-ivory">{t.question}</p>
              <div className="mt-2">
                {t.status === "loading" && <Thinking stage={t.stage} />}
                {t.status === "error" && (
                  <p className="text-[13px] text-risk">{t.error}</p>
                )}
                {t.status === "done" && t.result && <Answer result={t.result} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 px-5 py-4">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What changed since their last earnings?"
          aria-label="Ask a follow-up question"
          disabled={busy}
          className="w-full rounded-xl border border-line bg-ink-2 px-3.5 py-2.5 text-sm text-ivory placeholder:text-faint focus:border-line-strong disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || question.trim() === ""}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => void ask(s)}
              className="rounded-full border border-line bg-surface/40 px-2.5 py-1 text-[11px] text-faint transition-colors hover:border-line-strong hover:text-ivory disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Live "answering" indicator, reflecting the streamed ask stage. */
function Thinking({ stage }: { stage: AskStage }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-faint">
      <span className="relative flex size-2.5 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
        <span className="size-1.5 rounded-full bg-accent" />
      </span>
      {STAGE_LABEL[stage]}
    </div>
  );
}

/**
 * A grounded answer: the prose, then numbered source chips for the evidence it
 * cites. When unsupported it carries no chips and reads as an honest gap, so a
 * follow-up can never smuggle in an uncited claim.
 */
function Answer({ result }: { result: AskResult }) {
  return (
    <div>
      <p
        className={clsx(
          "text-[13.5px] leading-relaxed",
          result.supported ? "text-ivory/90" : "text-muted italic",
        )}
      >
        {result.answer}
      </p>
      {result.evidence.length > 0 && (
        <ol className="mt-2 space-y-1">
          {result.evidence.map((e, i) => (
            <li key={e.id} className="flex gap-2 text-[11.5px] leading-relaxed">
              <span className="font-mono text-faint">[{i + 1}]</span>
              <a
                href={e.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-ivory"
              >
                {e.sourceTitle}
              </a>
              <span className="font-mono text-faint">· {e.tool}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
