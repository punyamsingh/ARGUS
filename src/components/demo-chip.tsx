"use client";

import Link from "next/link";
import { clsx } from "@/lib/cn";
import { DEMO_PATH } from "@/lib/demo/path";
import { useInDemo } from "@/lib/demo/mode";

/**
 * The way into the demo surface (`/demo`) and back out again, sitting in the
 * header beside "Home".
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
 * invitation can be. "Try a demo" yields space below `sm` and reappears in the
 * menu panel; "Exit demo" always stays in the bar, because being stuck in demo
 * mode with the exit behind a disclosure is worse than a slightly busier header.
 * There's room — "Home" drops out at that width.
 */

/**
 * The chip's shape, shared with the menu panel's invitation so the two can't
 * drift apart. Deliberately carries no display utility: callers set their own
 * (`inline-flex`, or `hidden sm:inline-flex`), and a display class in here would
 * collide with theirs rather than yield to it.
 */
const CHIP =
  "items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-colors";
// `/85` rather than `/60`, matching the site-wide raise in #110: at the lower
// opacity the animated backdrop crossed the label.
const INVITE =
  "border-line bg-surface/85 text-muted hover:border-accent hover:text-accent";
const EXIT = "border-accent bg-accent/15 text-accent";

/** A live pulse while in demo mode; a steady dot outside it. */
function DemoDot({ pulse = false }: { pulse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative flex size-2 shrink-0 items-center justify-center"
    >
      {pulse && (
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
      )}
      <span className="size-2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
    </span>
  );
}

/**
 * The invitation on its own, for the menu panel — which never shows the exit,
 * since that stays in the bar at every width.
 */
export function DemoInvite({
  className,
  onClick,
}: {
  /** Must carry a display utility — see `CHIP` on why this isn't defaulted. */
  className: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={DEMO_PATH}
      onClick={onClick}
      aria-label="Try a demo"
      title="A scripted account, briefed live by the model"
      className={clsx(CHIP, INVITE, className)}
    >
      <DemoDot />
      Try a demo
    </Link>
  );
}

export function DemoChip() {
  const inDemo = useInDemo();

  // Below `sm` the invitation lives in the menu panel instead (see `MobileNav`).
  if (!inDemo) return <DemoInvite className="hidden sm:inline-flex" />;

  return (
    <Link
      href="/"
      aria-label="Exit demo mode"
      title="Exit demo mode"
      className={clsx("inline-flex", CHIP, EXIT)}
    >
      <DemoDot pulse />
      Exit demo
    </Link>
  );
}
