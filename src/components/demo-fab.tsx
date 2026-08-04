"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { clsx } from "@/lib/cn";
import { DEMO_PATH } from "@/lib/demo/path";
import { useInDemo } from "@/lib/demo/mode";

/**
 * The floating demo control — pinned to the bottom-right edge from `lg` up.
 *
 * It's the single way into the demo surface (`/demo`) and back out again, so a
 * presenter never hunts for a setting mid-pitch. The label is always visible:
 * this is an invitation, and an unlabelled disc doesn't invite anything.
 *
 * "Inside the demo" is broader than "on /demo": generating a demo brief carries
 * the presenter to `/brief/<id>`, and offering them "Try demo" there — while
 * they are watching one being written — reads as though the demo never started.
 * So the control follows `useInDemo()`, and shows the way out for the whole run
 * rather than only on the route the run began on.
 *
 * Dismissable, for anyone who'd rather just use the product — and dismissed
 * only for the session, matching the example brief in the studio: a fresh visit
 * gets the offer again, so the invitation can't be lost for good on one stray
 * click. Inside the demo there's no dismiss, because that button is the way out.
 *
 * It floats only from `lg` up, which is where the shell's gutters widen and the
 * studio splits into two columns, leaving the bottom-right corner empty. Below
 * that the page is one full-width column and a bottom-right overlay has nothing
 * to sit over *but* content: at 390px it landed squarely on the studio's
 * "Generate brief" button, so a tap on the right half of the page's primary
 * action dismissed the invitation instead of submitting the form, and at 768px
 * it covered the "Your product" toggle. Below `lg` the control lives in the
 * header bar instead — see `SiteHeader`, which reads the same store as this.
 */

const DISMISSED_KEY = "argus.demo-fab-dismissed";

/**
 * The dismissal, as a tiny external store — the same shape as `theme.ts` and
 * `brief-history.ts`. Read through `useSyncExternalStore` so the server
 * snapshot (never dismissed) matches the first client render and the real
 * value is adopted without an effect writing state back.
 */
let dismissed = false;
let hydrated = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  if (!hydrated) {
    hydrated = true;
    try {
      dismissed = sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // blocked storage just means the control stays offered
    }
    if (dismissed) queueMicrotask(() => listeners.forEach((l) => l()));
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function dismiss() {
  hydrated = true;
  dismissed = true;
  try {
    sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // best-effort; the dismissal still holds for this page
  }
  for (const l of listeners) l();
}

/**
 * Whether the demo invitation should still be offered. Shared with the header's
 * small-screen control so dismissing in one place settles it everywhere.
 */
export function useDemoInviteOffered(): boolean {
  return !useSyncExternalStore(
    subscribe,
    () => dismissed,
    () => false,
  );
}

export function DemoFab() {
  const inDemo = useInDemo();
  const offered = useDemoInviteOffered();

  // The exit is never dismissable — you always need a way out of the demo.
  if (!offered && !inDemo) return null;

  return (
    <div
      className={clsx(
        // `hidden lg:flex`: below `lg` the control moves into the header rather
        // than floating over the page's own buttons.
        "fixed bottom-6 right-6 z-50 hidden items-center rounded-full border shadow-xl shadow-cast/40 backdrop-blur-sm transition-colors lg:flex print:hidden",
        inDemo
          ? "border-accent bg-accent/20"
          : "border-line-strong bg-surface/95 hover:border-accent",
      )}
    >
      <Link
        href={inDemo ? "/" : DEMO_PATH}
        aria-label={inDemo ? "Exit demo mode" : "Try the demo"}
        title={
          inDemo
            ? "Exit demo mode"
            : "A scripted account, briefed live by the model"
        }
        className={clsx(
          "flex items-center gap-2.5 rounded-full py-3.5 pl-5 transition-colors",
          inDemo ? "pr-5 text-accent" : "pr-4 text-ivory hover:text-accent",
        )}
      >
        <span
          aria-hidden="true"
          className="relative flex size-2.5 shrink-0 items-center justify-center"
        >
          {/* A live pulse while in demo mode; a steady dot outside it. */}
          {inDemo && (
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
          )}
          <span className="size-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
        </span>
        <span className="whitespace-nowrap font-mono text-[12px] font-medium uppercase tracking-[0.14em]">
          {inDemo ? "Exit demo" : "Try demo"}
        </span>
      </Link>

      {!inDemo && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss the demo invitation"
          title="Dismiss"
          // Full-height strip so the 24px touch target doesn't inflate the pill.
          className="flex h-full items-center rounded-r-full py-3.5 pl-1.5 pr-4 text-faint transition-colors hover:text-ivory"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
