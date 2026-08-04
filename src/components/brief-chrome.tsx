"use client";

import { clsx } from "@/lib/cn";

/**
 * The window chrome worn by both the example preview and a real brief, so the
 * two read as the same object rather than a mockup and a page.
 *
 * The lights are the brief's controls, in the macOS arrangement people already
 * reach for: the corner one closes, the third zooms. A light with nothing to do
 * stays an unlit dot — a lit light always does what it looks like it does.
 */

type Light = { label: string; onClick: () => void };

export function BriefChrome({
  title = "argus · meeting brief",
  status,
  onClose,
  onExpand,
}: {
  title?: string;
  /** Right-hand slot, e.g. "ready · 38s". Kept even when empty so `title` stays centred. */
  status?: React.ReactNode;
  onClose?: Light;
  onExpand?: Light;
}) {
  return (
    // Hidden in print: the lights are controls, and paper has none.
    <div className="flex items-center justify-between border-b border-line px-5 py-3 print:hidden">
      <div className="group/chrome flex items-center gap-1.5">
        <ChromeLight action={onClose} tone="close" />
        <ChromeLight />
        <ChromeLight action={onExpand} tone="zoom" />
      </div>
      <span className="font-mono text-[11px] text-faint">{title}</span>
      <span className="font-mono text-[11px] text-signal">{status}</span>
    </div>
  );
}

function ChromeLight({
  action,
  tone,
}: {
  action?: Light;
  tone?: "close" | "zoom";
}) {
  if (!action) return <span className="size-2.5 rounded-full bg-line-strong" />;

  return (
    <button
      type="button"
      onClick={action.onClick}
      aria-label={action.label}
      title={action.label}
      className={clsx(
        "flex size-2.5 items-center justify-center rounded-full bg-line-strong text-ink transition-colors",
        tone === "close" && "hover:bg-risk focus-visible:bg-risk",
        tone === "zoom" && "hover:bg-signal focus-visible:bg-signal",
      )}
    >
      {tone === "close" ? <CloseGlyph /> : <ZoomGlyph />}
    </button>
  );
}

/** Revealed when the chrome is hovered or focused, as the real control does. */
const GLYPH =
  "size-[7px] opacity-0 transition-opacity group-hover/chrome:opacity-100 group-focus-within/chrome:opacity-100";

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className={GLYPH} fill="none" stroke="currentColor" strokeWidth="4.5" aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ZoomGlyph() {
  // A plus, the Aqua zoom glyph. The modern two-triangle version collapses into
  // something that reads as a "prohibited" slash at 7px; this stays legible and
  // matches the weight of the ×.
  return (
    <svg viewBox="0 0 24 24" className={GLYPH} fill="none" stroke="currentColor" strokeWidth="4.5" aria-hidden="true">
      <path strokeLinecap="round" d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}
