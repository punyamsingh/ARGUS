"use client";

import { useState } from "react";
import type {
  BriefResult,
  BriefStage,
  BriefStreamMessage,
} from "@/types/brief";
import { clsx } from "@/lib/cn";
import { BriefResultView } from "@/components/brief-result";
import { BriefActions } from "@/components/brief-actions";
import { BriefPreview } from "@/components/brief-preview";
import {
  saveToHistory,
  useBriefHistory,
  type HistoryEntry,
} from "@/lib/brief-history";

type Status = "idle" | "loading" | "done" | "error";

const STAGES: { key: BriefStage; label: string }[] = [
  { key: "resolving", label: "Resolving the company & person…" },
  { key: "gathering", label: "Gathering signals across sources…" },
  { key: "synthesizing", label: "Synthesising your brief…" },
];

/**
 * The brief "studio": the input form plus the result panel. Submits to
 * `/api/brief`, consumes the streamed stage events to drive a live skeleton,
 * persists results to local history, and offers export actions on the result.
 */
export function BriefStudio() {
  const [company, setCompany] = useState("");
  const [person, setPerson] = useState("");
  const [context, setContext] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<BriefStage>("resolving");
  const [result, setResult] = useState<BriefResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const history = useBriefHistory();

  const canSubmit =
    company.trim() !== "" && person.trim() !== "" && context.trim() !== "";

  async function run() {
    if (!canSubmit || status === "loading") return;

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
        },
        body: JSON.stringify({ company, person, context }),
      });

      // Validation failures come back as a plain JSON error (4xx).
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong.");
      }

      // Otherwise the route streams newline-delimited JSON: stage events, then a
      // terminal result or error.
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void run();
  }

  // Cmd/Ctrl+Enter submits from any field.
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void run();
    }
  }

  function openHistory(entry: HistoryEntry) {
    setCompany(entry.result.input.company);
    setPerson(entry.result.input.person);
    setContext(entry.result.input.context);
    setResult(entry.result);
    setStatus("done");
  }

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-10 px-6 md:grid-cols-[0.9fr_1.1fr]">
      {/* Form */}
      <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="md:sticky md:top-24">
        <div className="rounded-2xl border border-line-strong bg-surface/70 p-2 shadow-xl shadow-black/30 backdrop-blur-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label="Company"
              value={company}
              onChange={setCompany}
              placeholder="e.g. Stripe"
            />
            <Field
              label="Who you're meeting"
              value={person}
              onChange={setPerson}
              placeholder="e.g. Jane Doe"
            />
          </div>
          <Field
            label="Meeting context"
            value={context}
            onChange={setContext}
            placeholder="e.g. renewal + expansion call"
            className="mt-2"
          />
          <button
            type="submit"
            disabled={!canSubmit || status === "loading"}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? "Generating…" : "Generate brief"}
          </button>
        </div>
        <p className="mt-3 px-1 text-[12px] text-faint">
          Free, grounded in public sources. Every claim is cited.{" "}
          <span className="hidden sm:inline">Press ⌘/Ctrl + Enter to run.</span>
        </p>

        {history.length > 0 && (
          <RecentBriefs
            entries={history}
            onOpen={openHistory}
            disabled={status === "loading"}
          />
        )}
      </form>

      {/* Panel: idle → example · loading → stages · error → retry · done → brief */}
      <div>
        {status === "idle" && (
          <div className="relative">
            <span className="absolute -top-3 left-4 z-10 rounded-full border border-line bg-ink px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
              Example
            </span>
            <BriefPreview />
          </div>
        )}
        {status === "loading" && <Loader stage={stage} />}
        {status === "error" && (
          <ErrorCard message={error} onRetry={() => void run()} />
        )}
        {status === "done" && result && (
          <div className="space-y-4">
            <BriefResultView result={result} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <BriefActions result={result} />
              <button
                onClick={() => {
                  setStatus("idle");
                  setResult(null);
                }}
                className="rounded-full border border-line bg-surface/60 px-4 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2 print:hidden"
              >
                New brief
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A single labelled text input (label is visually hidden, kept for a11y). */
function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-xl border border-line bg-ink-2 px-3.5 py-2.5 text-sm text-ivory placeholder:text-faint focus:border-line-strong"
      />
    </label>
  );
}

/**
 * The "Recent briefs" switcher under the form. Disabled while a generation is in
 * flight so a history selection can't be clobbered by the streaming result.
 */
function RecentBriefs({
  entries,
  onOpen,
  disabled,
}: {
  entries: HistoryEntry[];
  onOpen: (e: HistoryEntry) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-5 px-1">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        Recent briefs
      </p>
      <ul className="space-y-1.5">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onOpen(e)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface/40 px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-ivory">
                  {e.company}
                </span>
                <span className="block truncate text-[11px] text-faint">
                  {e.person} · {e.context}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-faint">
                {e.result.evidence.length} src
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A shimmering skeleton placeholder bar. */
function Bar({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-pulse rounded bg-line-strong/60", className)} />
  );
}

/**
 * Loading state: a skeleton in the shape of the finished brief (header, four
 * sections, footer) so the layout doesn't jump when the real brief lands, with
 * the live pipeline stage — driven by #10's streamed `stage` events — surfaced
 * along the bottom.
 */
function Loader({ stage }: { stage: BriefStage }) {
  const current = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-surface/50">
      {/* header */}
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="w-full">
          <Bar className="h-2.5 w-24" />
          <Bar className="mt-3 h-5 w-2/3" />
          <Bar className="mt-2 h-3 w-1/2" />
        </div>
        <Bar className="hidden h-8 w-10 shrink-0 sm:block" />
      </div>

      {/* body — four section placeholders, matching the real brief grid */}
      <div className="grid gap-6 px-6 py-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Bar className="h-2 w-20" />
            <Bar className="mt-3 h-3 w-full" />
            <Bar className="mt-2 h-3 w-5/6" />
          </div>
        ))}
      </div>

      {/* live stage strip */}
      <div className="flex items-center gap-3 border-t border-line px-6 py-4">
        <span className="relative flex size-3 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {STAGES.map((s, i) => (
            <span
              key={s.key}
              className={
                i === current
                  ? "text-[12px] text-ivory"
                  : i < current
                    ? "text-[12px] text-faint line-through decoration-line-strong"
                    : "text-[12px] text-faint"
              }
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Error state: the failure message with a retry affordance. */
function ErrorCard({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[var(--radius-card)] border border-risk/40 bg-surface/50 p-8 text-center">
      <span className="size-2.5 rounded-full bg-risk shadow-[0_0_10px_var(--color-risk)]" />
      <p className="mt-4 max-w-sm text-sm text-ivory">
        {message ?? "Something went wrong."}
      </p>
      <button
        onClick={onRetry}
        className="mt-5 rounded-xl border border-line-strong bg-surface-2 px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-surface"
      >
        Try again
      </button>
    </div>
  );
}
