"use client";

import Link from "next/link";
import { clsx } from "@/lib/cn";
import { DEMO_PATH } from "@/lib/demo/path";
import { useInDemo } from "@/lib/demo/mode";

/**
 * The way into the demo surface (`/demo`) and back out again, sitting in the
 * header beside the primary CTA.
 *
 * It used to float in the bottom-right corner, which meant it permanently owned
 * that corner — and at the end of a page that corner belongs to the footer's own
 * controls, which it covered. A control that obscures other controls isn't worth
 * the prominence, so it moved into the bar, where it can't collide with anything
 * on any page.
 *
 * `useInDemo()` rather than the path: generating a demo brief carries the
 * presenter to `/brief/<id>`, and the exit has to follow them there.
 *
 * One rule decides its responsive behaviour: the way out is never hidden, the
 * invitation can be. "Demo" yields space below `sm` like the other nav items,
 * reachable from the menu panel; "Exit demo" always stays in the bar, because
 * being stuck in demo mode with the exit behind a disclosure is worse than a
 * slightly busier header. There's room — the CTA drops out at that width.
 */
export function DemoChip() {
  const inDemo = useInDemo();

  return (
    <Link
      href={inDemo ? "/" : DEMO_PATH}
      aria-label={inDemo ? "Exit demo mode" : "Try the demo"}
      title={
        inDemo ? "Exit demo mode" : "A scripted account, briefed live by the model"
      }
      className={clsx(
        "items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
        inDemo
          ? "inline-flex border-accent bg-accent/15 text-accent"
          : "hidden border-line bg-surface/60 text-muted hover:border-accent hover:text-accent sm:inline-flex",
      )}
    >
      <span
        aria-hidden="true"
        className="relative flex size-2 shrink-0 items-center justify-center"
      >
        {/* A live pulse while in demo mode; a steady dot outside it. */}
        {inDemo && (
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
        )}
        <span className="size-2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
      </span>
      {inDemo ? "Exit demo" : "Demo"}
    </Link>
  );
}
