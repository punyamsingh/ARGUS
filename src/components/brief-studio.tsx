"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { BriefResult, MeetingType, SellerProfile } from "@/types/brief";
import { MEETING_TYPES } from "@/types/brief";
import { clsx } from "@/lib/cn";
import { DISABLED_PRIMARY } from "@/lib/button";
import { BriefPreview } from "@/components/brief-preview";
import { BriefConversation } from "@/components/brief-conversation";
import {
  deleteBriefFromAccount,
  useBriefLibrary,
  type LibraryEntry,
} from "@/lib/briefs/library";
import { saveSellerProfile, useSellerProfile } from "@/lib/seller-profile";
import { PENDING_BRIEF_KEY, type PendingBrief } from "@/lib/use-brief-stream";
import { useDemoMode } from "@/lib/demo/mode";
import { DEMO_INPUT, DEMO_TOOLS } from "@/lib/demo/scenario";

/** Tailwind's `lg` breakpoint, as a value React can branch on. Only for
 *  defaults that need to know whether the second column exists — layout itself
 *  stays in CSS, so the server render is never wrong about it. */
function useWideViewport() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

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
  // Recent briefs: this browser's localStorage when signed out, the account's
  // saved briefs when signed in. The id of whichever one is open is tracked
  // separately because a remote brief's URL is its server id, not its
  // generatedAt timestamp.
  const { entries: history, signedIn, open } = useBriefLibrary();
  const [openedId, setOpenedId] = useState<string | null>(null);

  // Demo mode: the form is laced with the scripted account and locked, so a
  // walkthrough always runs the same known-good meeting. What the fields show —
  // and what Generate submits — comes from the scenario, not from local state,
  // which is why nothing here is overwritten when the switch flips back off.
  const demo = useDemoMode();
  const demoSeller = DEMO_INPUT.seller;
  const wideViewport = useWideViewport();

  // Seller profile — a set-once, remembered layer (progressive disclosure: the
  // 3-field path stays the default). A local draft mirrors the persisted profile
  // so partial/invalid edits never clobber storage; we persist on submit.
  const savedSeller = useSellerProfile();
  // null → follow the layout's own default; a click pins it either way.
  const [sellerOpen, setSellerOpen] = useState<boolean | null>(null);
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

  // A saved brief opens inline. Local entries carry their body already; an
  // account entry is a summary until now, so this is where it's fetched — which
  // keeps listing a long library cheap.
  async function openHistory(entry: LibraryEntry) {
    const result = entry.result ?? (await open(entry));
    if (!result) return;
    setCompany(result.input.company);
    setPerson(result.input.person);
    setContext(result.input.context);
    setMeetingType(result.input.meetingType ?? "");
    setOpened(result);
    setOpenedId(entry.id);
  }

  async function removeFromLibrary(entry: LibraryEntry) {
    if (!(await deleteBriefFromAccount(entry.id))) return;
    // Close the panel if the brief it was showing is the one that just went.
    if (openedId === entry.id) {
      setOpened(null);
      setOpenedId(null);
    }
  }

  // Nothing left in the right column → the form settles into a centred, wider
  // card that lays its own contents out in two columns rather than staying a
  // narrow rail with half the window empty beside it. Opening a recent brief
  // later fills the right column again and this reverses.
  const soloForm = exampleDismissed && !opened;
  // The two-column card only exists from `lg` up, and some defaults below
  // depend on actually having that second column — not just on being solo.
  const wideCard = soloForm && wideViewport;

  // "Your product" opens itself where there's a column to hold it (or where a
  // saved profile means it's already in use); elsewhere it stays collapsed and
  // the 3-field path is the short one. An explicit click always wins.
  const sellerShown = demo || (sellerOpen ?? (wideCard || !!savedSeller));

  return (
    <div
      className={clsx(
        "shell grid items-start gap-y-10 transition-[max-width,grid-template-columns,column-gap] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        // Splits at `lg`, not `md`: at 768px each column is ~350px and the brief
        // card degrades to three or four words a line.
        soloForm
          ? // Only widen where the card can actually use it — below `lg` it
            // stays a comfortable single column rather than one stretched row.
            "max-w-xl gap-x-0 lg:max-w-4xl lg:grid-cols-[1fr_0fr]"
          : // A fixed-ish form rail with the panel taking whatever the window
            // gives it — the desktop proportion stays put as the screen grows.
            "gap-x-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]",
      )}
    >
      {/* Form */}
      <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="lg:sticky lg:top-24">
        {demo && <DemoBanner />}
        {/* Near-opaque on purpose: the node-and-circuit canvas is a fixed layer
            behind the whole app, and at anything lighter its wires ran straight
            through the labels and placeholders. The remaining 5% plus the blur
            keep the card sitting *on* the backdrop rather than cut out of it. */}
        <div
          className={clsx(
            "rounded-2xl border border-line-strong bg-surface/95 p-5 shadow-xl shadow-cast/30 backdrop-blur-md sm:p-6",
            // Solo: the card is wide enough to sit the two input groups beside
            // each other, so the extra width carries content instead of air.
            // The submit spans the pair underneath — still the last thing in
            // the form, now the full width of it. Both columns start at the
            // top so the first label of each lands on the same line, however
            // tall the other one grows.
            soloForm && "lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:p-7",
          )}
        >
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Company"
                value={demo ? DEMO_INPUT.company : company}
                onChange={setCompany}
                placeholder="e.g. Swiggy"
                readOnly={demo}
              />
              <Field
                label="Who you're meeting"
                value={demo ? DEMO_INPUT.person : person}
                onChange={setPerson}
                placeholder="e.g. Priya Sharma"
                readOnly={demo}
              />
            </div>
            <Field
              label="Meeting context"
              value={demo ? DEMO_INPUT.context : context}
              onChange={setContext}
              placeholder="e.g. renewal + expansion call, 6 weeks from contract end"
              className="mt-4"
              readOnly={demo}
              lines={2}
            />
            <MeetingTypePicker
              value={demo ? (DEMO_INPUT.meetingType ?? "") : meetingType}
              onChange={setMeetingType}
              locked={demo}
              className="mt-4"
            />
          </div>

          {/* Optional refinement comes *before* the submit — a Generate button
              followed by more inputs reads as the end of the form, so "Your
              product" was easy to miss entirely. Stacked under the fields in
              the rail and collapsed there; beside them and already open once
              the card is wide, where showing it costs no scroll. */}
          <SellerPanel
            open={sellerShown}
            onToggle={() => setSellerOpen(!sellerShown)}
            configured={demo || !!savedSeller}
            locked={demo}
            className={clsx("mt-5", soloForm && "lg:mt-0")}
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

          <button
            type="submit"
            disabled={!canSubmit}
            className={clsx(
              "mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-accent px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-accent-strong",
              soloForm && "lg:col-span-2",
              DISABLED_PRIMARY,
            )}
          >
            Generate brief
          </button>
        </div>
        <p className="mt-3 px-1.5 text-[12px] leading-relaxed text-faint">
          {/* Three states: the demo's own line, the ready line, and — rather
              than leaving the reader to guess which of the three fields is
              still missing — why the button is inert. */}
          {demo ? (
            <>
              Scripted sources, real synthesis — the brief is written live by the
              model.{" "}
              <span className="hidden sm:inline">Press ⌘/Ctrl + Enter to run.</span>
            </>
          ) : canSubmit ? (
            <>
              Free, grounded in public sources. Every claim is cited.{" "}
              <span className="hidden sm:inline">Press ⌘/Ctrl + Enter to run.</span>
            </>
          ) : (
            "Fill in the company, who you're meeting and the meeting context to run."
          )}
        </p>

        {history.length > 0 && (
          <RecentBriefs
            entries={history}
            onOpen={openHistory}
            onDelete={signedIn ? removeFromLibrary : undefined}
          />
        )}
      </form>

      {/* Panel: a recent brief opened inline, else the example. New briefs open
          on the focused page instead. */}
      <div>
        {opened ? (
          <BriefConversation
            result={opened}
            onClose={() => {
              setOpened(null);
              setOpenedId(null);
            }}
            onExpand={() =>
              router.push(
                `/brief/${encodeURIComponent(openedId ?? opened.meta.generatedAt)}`,
              )
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

/**
 * A single labelled text input. The label is visible — these fields used to
 * carry `sr-only` labels and lean on the placeholder, which means the only clue
 * to what a field is for disappears the moment someone types in it. That is
 * worst in the seller panel, where four otherwise-identical inputs sit together.
 * Matches the contact form's field styling so both forms read the same.
 *
 * `readOnly` is how demo mode pins a field: still focusable and readable, but
 * the scripted value can't be edited out from under the presenter.
 *
 * `lines` turns it into a textarea. The two fields that take prose — the
 * meeting context and the value proposition — are the ones people write a
 * sentence into, and a one-line box scrolls that sentence out of sight as they
 * type. Everything else here is a name or a short list and stays an input.
 */
function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
  readOnly = false,
  lines,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  lines?: number;
}) {
  const control =
    "w-full rounded-xl border border-line bg-ink-2 px-3.5 py-2.5 text-sm text-ivory placeholder:text-faint focus:border-line-strong";
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
      {lines ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          rows={lines}
          // Grows by hand, never sideways — a wider-than-column textarea would
          // break the two-column card.
          className={clsx(
            control,
            "resize-y leading-relaxed",
            readOnly && "cursor-default resize-none text-muted",
          )}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={clsx(control, readOnly && "cursor-default text-muted")}
        />
      )}
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
  className,
}: {
  value: MeetingType | "";
  onChange: (v: MeetingType | "") => void;
  /** Demo mode — the scripted meeting type is shown but can't be changed. */
  locked?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap gap-2", className)}>
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
                : "border-line bg-surface/80 text-faint hover:border-line-strong hover:text-ivory",
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
 * The "Your product" section — the persistent seller profile. Set once and
 * remembered so every brief is tailored to what the rep sells. Company +
 * what-you-sell are the only fields that matter; the rest sharpen fit.
 * Clearing removes the saved profile.
 *
 * Deliberately unboxed: it's a labelled section of the form card, not a card
 * inside a card, so its inputs sit on the same ground as the ones above and
 * the eye isn't asked to cross two more borders to reach them. The disclosure
 * row is the only chrome, and it reads as a heading with a control on it.
 */
function SellerPanel({
  open,
  onToggle,
  configured,
  locked = false,
  className,
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
  className?: string;
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
    <div className={clsx(className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        disabled={locked}
        className="group flex w-full items-center justify-between gap-3 text-left disabled:cursor-default"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ivory">
          Your product
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            {locked
              ? "demo · tailors the brief"
              : configured
                ? "saved · tailors the brief"
                : "optional · tailors the brief"}
          </span>
        </span>
        {/* The only chrome on the row: a hit-target-sized glyph that says the
            section folds. Ringed on hover so it reads as pressable without a
            border sitting there permanently. */}
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md text-faint transition-colors group-hover:bg-ink-2 group-hover:text-ivory group-disabled:bg-transparent group-disabled:text-faint">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="mt-3 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Your company"
              value={company}
              onChange={onCompany}
              placeholder="e.g. Tattva Analytics"
              readOnly={locked}
            />
            {/* The list is comma-split; the placeholder shows that rather than
                spending a label on the syntax. */}
            <Field
              label="Named competitors"
              value={competitors}
              onChange={onCompetitors}
              placeholder="e.g. Increff, Unicommerce"
              readOnly={locked}
            />
          </div>
          <Field
            label="What you sell"
            value={offering}
            onChange={onOffering}
            placeholder="e.g. self-serve retail analytics for D2C brands"
            readOnly={locked}
          />
          <Field
            label="Value proposition"
            value={valueProp}
            onChange={onValueProp}
            placeholder="e.g. ship insights without a data team"
            readOnly={locked}
            lines={2}
          />
          {/* Demo mode keeps its note — a presenter needs to know the scripted
              profile isn't overwriting their own. The two never appear
              together: Clear is hidden while locked. */}
          {locked && (
            <p className="text-[11px] leading-relaxed text-faint">
              Scripted for the demo — your own saved profile is untouched.
            </p>
          )}
          {configured && !locked && (
            <button
              type="button"
              onClick={onClear}
              className="justify-self-end text-[11px] text-faint underline decoration-line-strong underline-offset-2 transition-colors hover:text-ivory"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The "Recent briefs" switcher under the form — opens a saved brief inline.
 * `onDelete` is only passed when signed in: a local brief ages out of
 * localStorage on its own, so there's nothing meaningful to delete there.
 */
function RecentBriefs({
  entries,
  onOpen,
  onDelete,
}: {
  entries: LibraryEntry[];
  onOpen: (e: LibraryEntry) => void;
  onDelete?: (e: LibraryEntry) => void;
}) {
  return (
    <div className="mt-6 px-1.5">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        Recent briefs
      </p>
      <ul className="space-y-1.5">
        {entries.map((e) => (
          <li key={e.id} className="group relative">
            <button
              type="button"
              onClick={() => onOpen(e)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface/90 px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-ivory">
                  {e.company}
                </span>
                <span className="block truncate text-[11px] text-faint">
                  {e.person} · {e.context}
                </span>
              </span>
              <span
                className={clsx(
                  "shrink-0 font-mono text-[11px] text-faint",
                  onDelete && "group-hover:invisible",
                )}
              >
                {e.evidenceCount} src
              </span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(e)}
                aria-label={`Delete the brief for ${e.company}`}
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md p-1.5 text-faint transition-colors hover:bg-surface hover:text-risk group-hover:block"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7M6.5 7l.7 11a1.5 1.5 0 0 0 1.5 1.4h6.6a1.5 1.5 0 0 0 1.5-1.4l.7-11"
                  />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
