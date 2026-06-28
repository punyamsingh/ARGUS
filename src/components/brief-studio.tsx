"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BriefResult,
  BriefStage,
  BriefStreamMessage,
  MeetingType,
  SellerProfile,
} from "@/types/brief";
import { MEETING_TYPES } from "@/types/brief";
import { clsx } from "@/lib/cn";
import { getSessionId } from "@/lib/session-id";
import { BriefResultView } from "@/components/brief-result";
import { BriefActions } from "@/components/brief-actions";
import { BriefPreview } from "@/components/brief-preview";
import { BriefFollowUps } from "@/components/brief-followups";
import {
  saveToHistory,
  useBriefHistory,
  type HistoryEntry,
} from "@/lib/brief-history";
import { saveSellerProfile, useSellerProfile } from "@/lib/seller-profile";

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
  const [meetingType, setMeetingType] = useState<MeetingType | "">("");
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<BriefStage>("resolving");
  const [result, setResult] = useState<BriefResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const history = useBriefHistory();

  // Seller profile — a set-once, remembered layer (progressive disclosure: the
  // 3-field path stays the default). A local draft mirrors the persisted profile
  // so partial/invalid edits never clobber storage; we persist on submit.
  const savedSeller = useSellerProfile();
  const [sellerOpen, setSellerOpen] = useState(false);
  const [sellerCompany, setSellerCompany] = useState("");
  const [offering, setOffering] = useState("");
  const [valueProp, setValueProp] = useState("");
  const [competitors, setCompetitors] = useState("");
  const seededRef = useRef(false);

  // Seed the draft once from the persisted profile when it hydrates, and open
  // the panel so a returning rep sees their product is already known.
  useEffect(() => {
    if (seededRef.current || !savedSeller) return;
    seededRef.current = true;
    setSellerCompany(savedSeller.company);
    setOffering(savedSeller.offering);
    setValueProp(savedSeller.valueProp ?? "");
    setCompetitors(savedSeller.competitors.join(", "));
    setSellerOpen(true);
  }, [savedSeller]);

  /** Build a valid SellerProfile from the draft, or undefined if incomplete. */
  function buildSeller(): SellerProfile | undefined {
    const c = sellerCompany.trim();
    const o = offering.trim();
    if (!c || !o) return undefined;
    const vp = valueProp.trim();
    return {
      company: c,
      offering: o,
      ...(vp ? { valueProp: vp } : {}),
      competitors: competitors
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  function clearSeller() {
    setSellerCompany("");
    setOffering("");
    setValueProp("");
    setCompetitors("");
    saveSellerProfile(null);
  }

  const canSubmit =
    company.trim() !== "" && person.trim() !== "" && context.trim() !== "";

  async function run() {
    if (!canSubmit || status === "loading") return;

    setStatus("loading");
    setStage("resolving");
    setError(null);
    setResult(null);

    // Persist the seller profile so it's remembered next time (or no-op if blank).
    const seller = buildSeller();
    if (seller) saveSellerProfile(seller);

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
        body: JSON.stringify({
          company,
          person,
          context,
          ...(seller ? { seller } : {}),
          ...(meetingType ? { meetingType } : {}),
        }),
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
          <MeetingTypePicker value={meetingType} onChange={setMeetingType} />
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

        <SellerPanel
          open={sellerOpen}
          onToggle={() => setSellerOpen((v) => !v)}
          configured={!!savedSeller}
          company={sellerCompany}
          onCompany={setSellerCompany}
          offering={offering}
          onOffering={setOffering}
          valueProp={valueProp}
          onValueProp={setValueProp}
          competitors={competitors}
          onCompetitors={setCompetitors}
          onClear={clearSeller}
        />

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
            {/* Conversational layer — keyed to the brief so each new brief starts
                a fresh conversation. The brief above stays the pinned artifact. */}
            <BriefFollowUps key={result.meta.generatedAt} result={result} />
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

/** Optional meeting-type chips — a light hint that sharpens the inferred
 *  objective (and, in #73, section ordering). Click a selected chip to clear. */
function MeetingTypePicker({
  value,
  onChange,
}: {
  value: MeetingType | "";
  onChange: (v: MeetingType | "") => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 px-1">
      {MEETING_TYPES.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? "" : t)}
            className={clsx(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
              active
                ? "border-accent bg-accent/15 text-accent"
                : "border-line bg-surface/40 text-faint hover:border-line-strong hover:text-ivory",
            )}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The "Your product" panel — the persistent seller profile. Collapsed by default
 * (progressive disclosure); set once and remembered so every brief is tailored
 * to what the rep sells. Company + what-you-sell are the only fields that matter;
 * the rest sharpen fit. Clearing removes the saved profile.
 */
function SellerPanel({
  open,
  onToggle,
  configured,
  company,
  onCompany,
  offering,
  onOffering,
  valueProp,
  onValueProp,
  competitors,
  onCompetitors,
  onClear,
}: {
  open: boolean;
  onToggle: () => void;
  configured: boolean;
  company: string;
  onCompany: (v: string) => void;
  offering: string;
  onOffering: (v: string) => void;
  valueProp: string;
  onValueProp: (v: string) => void;
  competitors: string;
  onCompetitors: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface/40 px-3 py-2 text-left transition-colors hover:border-line-strong"
      >
        <span className="flex items-center gap-2 text-[13px] text-ivory">
          Your product
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            {configured ? "saved · tailors the brief" : "optional · tailors the brief"}
          </span>
        </span>
        <span className="text-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-2 grid gap-2 rounded-xl border border-line bg-surface/30 p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label="Your company"
              value={company}
              onChange={onCompany}
              placeholder="e.g. Acme Analytics"
            />
            <Field
              label="Named competitors (comma-separated)"
              value={competitors}
              onChange={onCompetitors}
              placeholder="e.g. Looker, Mode"
            />
          </div>
          <Field
            label="What you sell"
            value={offering}
            onChange={onOffering}
            placeholder="e.g. self-serve product analytics for B2B SaaS"
          />
          <Field
            label="Value proposition"
            value={valueProp}
            onChange={onValueProp}
            placeholder="e.g. ship insights without a data team"
          />
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] text-faint">
              Remembered on this device. Only “what you sell” is used to tailor;
              never invented.
            </p>
            {configured && (
              <button
                type="button"
                onClick={onClear}
                className="shrink-0 text-[11px] text-faint underline decoration-line-strong underline-offset-2 transition-colors hover:text-ivory"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
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
