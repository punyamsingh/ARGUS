"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BriefResult, MeetingType, SellerProfile } from "@/types/brief";
import { MEETING_TYPES } from "@/types/brief";
import { clsx } from "@/lib/cn";
import { DISABLED_PRIMARY } from "@/lib/button";
import { BriefPreview } from "@/components/brief-preview";
import { BriefConversation } from "@/components/brief-conversation";
import {
  useBriefHistory,
  type HistoryEntry,
} from "@/lib/brief-history";
import { saveSellerProfile, useSellerProfile } from "@/lib/seller-profile";
import { PENDING_BRIEF_KEY } from "@/lib/use-brief-stream";

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
    company.trim() !== "" && person.trim() !== "" && context.trim() !== "";

  /** Stash the input and jump to the focused page, which streams the brief. */
  function startGenerate() {
    if (!canSubmit) return;

    const seller = buildSeller();
    if (seller) saveSellerProfile(seller);

    const input = {
      company: company.trim(),
      person: person.trim(),
      context: context.trim(),
      ...(seller ? { seller } : {}),
      ...(meetingType ? { meetingType } : {}),
    };
    try {
      sessionStorage.setItem(PENDING_BRIEF_KEY, JSON.stringify(input));
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
        // Splits at `lg`, not `md`: at 768px each column is ~350px and the brief
        // card degrades to three or four words a line.
        soloForm
          ? "max-w-xl gap-x-0 lg:grid-cols-[1fr_0fr]"
          : "max-w-6xl gap-x-10 lg:grid-cols-[0.9fr_1.1fr]",
      )}
    >
      {/* Form */}
      <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="lg:sticky lg:top-24">
        <div className="rounded-2xl border border-line-strong bg-surface/70 p-4 shadow-xl shadow-cast/30 backdrop-blur-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
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
            className="mt-3"
          />
          <MeetingTypePicker value={meetingType} onChange={setMeetingType} />
          <button
            type="submit"
            disabled={!canSubmit}
            className={clsx(
              "mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-accent-strong",
              DISABLED_PRIMARY,
            )}
          >
            Generate brief
          </button>
        </div>
        <p className="mt-3 px-1.5 text-[12px] leading-relaxed text-faint">
          {/* Say why the button is inert rather than leaving the reader to
              guess which of the three fields is still missing. */}
          {canSubmit ? (
            <>
              Free, grounded in public sources. Every claim is cited.{" "}
              <span className="hidden sm:inline">
                Press ⌘/Ctrl + Enter to run.
              </span>
            </>
          ) : (
            "Fill in the company, who you're meeting and the meeting context to run."
          )}
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

/**
 * A single labelled text input. The label is visible — these fields used to
 * carry `sr-only` labels and lean on the placeholder, which means the only clue
 * to what a field is for disappears the moment someone types in it. That is
 * worst in the seller panel, where four otherwise-identical inputs sit together.
 * Matches the contact form's field styling so both forms read the same.
 */
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
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-ink-2 px-3.5 py-2.5 text-sm text-ivory placeholder:text-faint focus:border-line-strong"
      />
    </label>
  );
}

/** Optional meeting-type chips — a light hint that sharpens the inferred
 *  objective and section ordering. Click a selected chip to clear. */
function MeetingTypePicker({
  value,
  onChange,
}: {
  value: MeetingType | "";
  onChange: (v: MeetingType | "") => void;
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
    <div className="mt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface/40 px-4 py-3 text-left transition-colors hover:border-line-strong"
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
        <div className="mt-2 grid gap-3 rounded-xl border border-line bg-surface/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] leading-relaxed text-faint">
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
