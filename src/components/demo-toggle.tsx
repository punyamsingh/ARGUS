"use client";

import { clsx } from "@/lib/cn";
import { setDemoMode, useDemoMode } from "@/lib/demo/mode";

/**
 * The demo-mode switch, sat beside the theme toggle in the footer. Deliberately
 * quiet: it's a presenter control, not a product feature, so it reads as a small
 * labelled switch rather than a call to action — and lights up only when on, so
 * nobody demos without knowing they're in demo mode.
 */
export function DemoToggle() {
  const on = useDemoMode();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setDemoMode(!on)}
      title={
        on
          ? "Demo mode is on — scripted sources, real synthesis"
          : "Demo mode: run the pitch on a scripted account"
      }
      className={clsx(
        "flex items-center gap-2 rounded-full border px-2.5 py-1 transition-colors",
        on
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-line bg-surface/40 text-faint hover:border-line-strong hover:text-ivory",
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "relative h-3 w-6 rounded-full transition-colors",
          on ? "bg-accent/40" : "bg-line-strong",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 size-2 rounded-full transition-[left] duration-200",
            on ? "left-3.5 bg-accent" : "left-0.5 bg-muted",
          )}
        />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider">
        Demo{on ? " · on" : ""}
      </span>
    </button>
  );
}
