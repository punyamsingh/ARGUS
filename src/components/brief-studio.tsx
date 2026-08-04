"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BriefResult, MeetingType, SellerProfile } from "@/types/brief";
import { MEETING_TYPES } from "@/types/brief";
import { clsx } from "@/lib/cn";
import { BriefPreview } from "@/components/brief-preview";
import { BriefConversation } from "@/components/brief-conversation";
import {
  useBriefHistory,
  type HistoryEntry,
} from "@/lib/brief-history";
import { saveSellerProfile, useSellerProfile } from "@/lib/seller-profile";
import { PENDING_BRIEF_KEY, type PendingBrief } from "@/lib/use-brief-stream";
import { useDemoMode } from "@/lib/demo/mode";
import { DEMO_INPUT, DEMO_TOOLS } from "@/lib/demo/scenario";

/**
 * The brief "studio": the input form plus a preview panel. Submitting hands the
 * input to the focused brief page (`/brief/new`), which streams the generation
 * there. Recent briefs open inline in the panel — exactly as before — with an
 * Expand button to pop into the focused full-page view.
 */
export function BriefStudio() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [person, setPerson] = useState("");
  const [context, setContext] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType | "">("");
  // A recent brief opened inline in the panel (null → show the example).
  const [opened, setOpened] = useState<BriefResult | null>(null);
  // The example is a one-time explainer; once dismissed it stays gone for the
  // session (deliberately not persisted — a fresh visit gets the pitch again).
  // `leaving` runs the fade first; the unmount waits for it so the layout
  // reflow reads as one motion rather than a jump.
  const [exampleDismissed, setExampleDismissed] = useState(false);
  const [exampleLeaving, setExampleLeaving] = useState(false);
  const history = useBriefHistory();

  // Demo mode: the form is laced with the scripted account and locked, so a
  // walkthrough always runs the same known-good meeting. What the fields show —
  // and what Generate submits — comes from the scenario, not from local state,
  // which is why nothing here is overwritten when the switch flips back off.
  const demo = useDemoMode();
  const demoSeller = DEMO_INPUT.seller;

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
    demo ||
    (company.trim() !== "" && person.trim() !== "" && context.trim() !== "");

  /** Stash the input and jump to the focused page, which streams the brief. */
  function startGenerate() {
    if (!canSubmit) return;

    // In demo mode the scenario is the input, and the rep's real saved seller
    // profile is left untouched.
    const seller = demo ? undefined : buildSeller();
    if (seller) saveSellerProfile(seller);

    const input = demo
      ? DEMO_INPUT
      : {
          company: company.trim(),
          person: person.trim(),
          context: context.trim(),
          ...(seller ? { seller } : {}),
          ...(meetingType ? { meetingType } : {}),
        };
    const pending: PendingBrief = { input, ...(demo ? { demo: true } : {}) };
    try {
      sessionStorage.setItem(PENDING_BRIEF_KEY, JSON.stringify(pending));
    } catch {
      // best-effort; if storage is blocked the focused page shows a prompt
    }
    router.push("/brief/new");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startGenerate();
  }

  // Cmd/Ctrl+Enter submits from any field.
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      startGenerate();
    }
  }

  function openHistory(entry: HistoryEntry) {
    setCompany(entry.result.input.company);
    setPerson(entry.result.input.person);
    setContext(entry.result.input.context);
    setMeetingType(entry.result.input.meetingType ?? "");
    setOpened(entry.result);
  }

  // Nothing left in the right column → the form settles into a centred single
  // column. Opening a recent brief later fills it again and this reverses.
  const soloForm = exampleDismissed && !opened;

  return (
    <div
      className={clsx(
        "mx-auto grid items-start gap-y-10 px-6 transition-[max-width,grid-template-columns,column-gap] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        soloForm
          ? "max-w-xl gap-x-0 md:grid-cols-[1fr_0fr]"
          : "max-w-6xl gap-x-10 md:grid-cols-[0.9fr_1.1fr]",
      )}
    >
      {/* Form */}
      <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="md:sticky md:top-24">
        {demo && <DemoBanner />}
        <div className="rounded-2xl border border-line-strong bg-surface/70 p-4 shadow-xl shadow-cast/30 backdrop-blur-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Company"
              value={demo ? DEMO_INPUT.company : company}
              onChange={setCompany}
              placeholder="e.g. Stripe"
              readOnly={demo}
            />
            <Field
              label="Who you're meeting"
              value={demo ? DEMO_INPUT.person : person}
              onChange={setPerson}
              placeholder="e.g. Jane Doe"
              readOnly={demo}
            />
          </div>
          <Field
            label="Meeting context"
            value={demo ? DEMO_INPUT.context : context}
            onChange={setContext}
            placeholder="e.g. renewal + expansion call"
            className="mt-3 block"
            readOnly={demo}
          />
          <MeetingTypePicker
            value={demo ? (DEMO_INPUT.meetingType ?? "") : meetingType}
            onChange={setMeetingType}
            locked={demo}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted"
          >
            Generate brief
          </button>
        </div>
        <p className="mt-3 px-1.5 text-[12px] leading-relaxed text-faint">
          {demo ? (
            <>
              Scripted sources, real synthesis — the brief is written live by the
              model.{" "}
              <span className="hidden sm:inline">Press ⌘/Ctrl + Enter to run.</span>
            </>
          ) : (
            <>
              Free, grounded in public sources. Every claim is cited.{" "}
              <span className="hidden sm:inline">Press ⌘/Ctrl + Enter to run.</span>
            </>
          )}
        </p>

        <SellerPanel
          open={demo || sellerOpen}
          onToggle={() => setSellerOpen((v) => !v)}
          configured={demo || !!savedSeller}
          locked={demo}
          company={demo ? (demoSeller?.company ?? "") : sellerCompany}
          onCompany={setSellerCompany}
          offering={demo ? (demoSeller?.offering ?? "") : offering}
          onOffering={setOffering}
          valueProp={demo ? (demoSeller?.valueProp ?? "") : valueProp}
          onValueProp={setValueProp}
          competitors={
            demo ? (demoSeller?.competitors.join(", ") ?? "") : competitors
          }
          onCompetitors={setCompetitors}
          onClear={clearSeller}
        />

        {history.length > 0 && (
          <RecentBriefs entries={history} onOpen={openHistory} />
        )}
      </form>

      {/* Panel: a recent brief opened inline, else the example. New briefs open
          on the focused page instead. */}
      <div>
        {opened ? (
          <BriefConversation
            result={opened}
            onClose={() => setOpened(null)}
            onExpand={() =>
              router.push(`/brief/${encodeURIComponent(opened.meta.generatedAt)}`)
            }
          />
        ) : exampleDismissed ? null : (
          <div
            className={clsx(
              "relative transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              exampleLeaving && "pointer-events-none scale-[0.97] opacity-0",
            )}
            // Unmount only once the fade has finished, so the column collapse
            // starts from an already-invisible panel. Under reduced motion the
            // global override shortens this to ~0ms and it still fires.
            onTransitionEnd={(e) => {
              if (e.target === e.currentTarget && e.propertyName === "opacity") {
                setExampleDismissed(true);
              }
            }}
          >
            <span className="absolute -top-3 left-4 z-10 rounded-full border border-line bg-ink px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
              Example
            </span>
            <BriefPreview onClose={() => setExampleLeaving(true)} />
          </div>
        )}
      </div>
    </div>
  );
}

/** A single labelled text input (label is visually hidden, kept for a11y).
 *  `readOnly` is how demo mode pins a field: still focusable and readable, but
 *  the scripted value can't be edited out from under the presenter. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <label className={className}>
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        readOnly={readOnly}
        className={clsx(
          "w-full rounded-xl border border-line bg-ink-2 px-3.5 py-2.5 text-sm text-ivory placeholder:text-faint focus:border-line-strong",
          readOnly && "cursor-default text-muted",
        )}
      />
    </label>
  );
}

/**
 * The demo-mode banner above the form. It says plainly what is scripted and
 * what isn't — the sources are fixed, the brief is still written live — so a
 * demo never overstates what the audience is watching.
 */
function DemoBanner() {
  return (
    <div className="mb-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
        <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
        Demo mode
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ivory/90">
        A scripted account with a fixed set of {DEMO_TOOLS.length} live sources.
        Generate runs the real model over that evidence — only the gathering step
        is pre-recorded.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {DEMO_TOOLS.map((t) => (
          <span
            key={t}
            className="rounded-full border border-line bg-ink-2 px-2 py-0.5 font-mono text-[10px] text-muted"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Optional meeting-type chips — a light hint that sharpens the inferred
 *  objective and section ordering. Click a selected chip to clear. */
function MeetingTypePicker({
  value,
  onChange,
  locked = false,
}: {
  value: MeetingType | "";
  onChange: (v: MeetingType | "") => void;
  /** Demo mode — the scripted meeting type is shown but can't be changed. */
  locked?: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {MEETING_TYPES.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            disabled={locked}
            onClick={() => onChange(active ? "" : t)}
            className={clsx(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
              active
                ? "border-accent bg-accent/15 text-accent"
                : "border-line bg-surface/40 text-faint hover:border-line-strong hover:text-ivory",
              locked && !active && "opacity-40",
              locked && "cursor-default",
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
  locked = false,
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
  /** Demo mode — the scripted seller is shown, read-only, and can't be cleared. */
  locked?: boolean;
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
    <div className="mt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        disabled={locked}
        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface/40 px-4 py-3 text-left transition-colors hover:border-line-strong disabled:cursor-default"
      >
        <span className="flex items-center gap-2 text-[13px] text-ivory">
          Your product
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            {locked
              ? "demo · tailors the brief"
              : configured
                ? "saved · tailors the brief"
                : "optional · tailors the brief"}
          </span>
        </span>
        <span className="text-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-2 grid gap-3 rounded-xl border border-line bg-surface/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Your company"
              value={company}
              onChange={onCompany}
              placeholder="e.g. Acme Analytics"
              readOnly={locked}
            />
            <Field
              label="Named competitors (comma-separated)"
              value={competitors}
              onChange={onCompetitors}
              placeholder="e.g. Looker, Mode"
              readOnly={locked}
            />
          </div>
          <Field
            label="What you sell"
            value={offering}
            onChange={onOffering}
            placeholder="e.g. self-serve product analytics for B2B SaaS"
            readOnly={locked}
          />
          <Field
            label="Value proposition"
            value={valueProp}
            onChange={onValueProp}
            placeholder="e.g. ship insights without a data team"
            readOnly={locked}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] leading-relaxed text-faint">
              {locked
                ? "Scripted for the demo — your own saved profile is untouched."
                : "Remembered on this device. Only “what you sell” is used to tailor; never invented."}
            </p>
            {configured && !locked && (
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

/** The "Recent briefs" switcher under the form — opens a saved brief inline. */
function RecentBriefs({
  entries,
  onOpen,
}: {
  entries: HistoryEntry[];
  onOpen: (e: HistoryEntry) => void;
}) {
  return (
    <div className="mt-6 px-1.5">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        Recent briefs
      </p>
      <ul className="space-y-1.5">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onOpen(e)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface/40 px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
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
