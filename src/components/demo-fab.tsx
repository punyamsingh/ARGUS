"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/cn";
import { DEMO_PATH, isDemoPath } from "@/lib/demo/path";

/**
 * The floating demo control — pinned to the bottom-right edge on every page.
 *
 * It's the single way into the demo surface (`/demo`) and back out again, so a
 * presenter never hunts for a setting mid-pitch. Off the demo route it's a
 * collapsed disc that expands into a labelled pill on hover/focus; on the demo
 * route it stays expanded and turns into the exit, because a demo you can't
 * visibly leave is a demo someone forgets they're in.
 */
export function DemoFab() {
  const pathname = usePathname();
  const inDemo = isDemoPath(pathname);

  return (
    <Link
      href={inDemo ? "/" : DEMO_PATH}
      aria-label={inDemo ? "Exit demo mode" : "Open demo mode"}
      title={
        inDemo
          ? "Exit demo mode"
          : "Demo mode — a scripted account, briefed live by the model"
      }
      className={clsx(
        "group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border py-3 shadow-xl shadow-cast/40 backdrop-blur-sm transition-[background-color,border-color,padding,color] print:hidden",
        // Collapsed to a disc until hovered/focused, so it never fights the page.
        inDemo
          ? "border-accent bg-accent/20 px-4 text-accent"
          : "border-line-strong bg-surface/80 px-3 text-muted hover:border-accent hover:bg-surface hover:px-4 hover:text-accent focus-visible:border-accent focus-visible:px-4 focus-visible:text-accent",
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "relative flex size-2.5 shrink-0 items-center justify-center",
        )}
      >
        {/* A live pulse while in demo mode; a steady dot outside it. */}
        {inDemo && (
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
        )}
        <span className="size-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
      </span>

      <span
        className={clsx(
          "overflow-hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] transition-[max-width,opacity] duration-300",
          inDemo
            ? "max-w-[10rem] opacity-100"
            : "max-w-0 opacity-0 group-hover:max-w-[10rem] group-hover:opacity-100 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100",
        )}
      >
        {inDemo ? "Exit demo" : "Demo"}
      </span>
    </Link>
  );
}
