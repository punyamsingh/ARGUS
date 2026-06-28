"use client";

import { useState } from "react";
import type {
  BriefResult,
  BriefStage,
  BriefStreamMessage,
} from "@/types/brief";
import { BriefResultView } from "@/components/brief-result";
import { BriefPreview } from "@/components/brief-preview";

type Status = "idle" | "loading" | "done" | "error";

const STAGES: { key: BriefStage; label: string }[] = [
  { key: "resolving", label: "Resolving the company & person…" },
  { key: "gathering", label: "Gathering signals across sources…" },
  { key: "synthesizing", label: "Synthesising your brief…" },
];

export function BriefStudio() {
  const [company, setCompany] = useState("");
  const [person, setPerson] = useState("");
  const [context, setContext] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<BriefStage>("resolving");
  const [result, setResult] = useState<BriefResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        headers: { "Content-Type": "application/json" },
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

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr]">
      {/* Form */}
      <form onSubmit={onSubmit} className="lg:sticky lg:top-24">
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
          Free, grounded in public sources. Every claim is cited.
        </p>
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
            <button
              onClick={() => {
                setStatus("idle");
                setResult(null);
              }}
              className="rounded-full border border-line bg-surface/60 px-4 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              New brief
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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

function Loader({ stage }: { stage: BriefStage }) {
  const current = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[var(--radius-card)] border border-line-strong bg-surface/50 p-8 text-center">
      <span className="relative flex size-12 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        <span className="size-3 rounded-full bg-accent shadow-[0_0_16px_var(--color-accent)]" />
      </span>
      <div className="mt-6 space-y-2">
        {STAGES.map((s, i) => (
          <p
            key={s.key}
            className={
              i === current
                ? "text-sm text-ivory"
                : i < current
                  ? "text-sm text-faint line-through decoration-line-strong"
                  : "text-sm text-faint"
            }
          >
            {s.label}
          </p>
        ))}
      </div>
      <p className="mt-6 font-mono text-[11px] text-faint">
        usually under a minute
      </p>
    </div>
  );
}

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
