"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "@/lib/cn";
import { DemoInvite } from "@/components/demo-chip";

/**
 * The header's small-screen navigation. The desktop header lays the links out
 * inline from `md` up; below that they collapse behind this disclosure, so the
 * routes stay reachable from the header on a phone rather than only from the
 * footer at the bottom of the page.
 *
 * Deliberately a plain disclosure rather than a full-screen overlay: three links
 * do not warrant trapping focus or locking the page behind a modal.
 */
type NavLink = { label: string; href: string };

export function MobileNav({
  items,
  home,
  demo,
}: {
  items: NavLink[];
  /** The bar's "Home" link, which does not fit alongside the wordmark below `sm`. */
  home: NavLink;
  /** Whether to offer the demo *invitation*, which yields space in the bar
   *  below `sm`. Never the exit — that stays in the bar at every width, so
   *  nobody has to open a menu to get out of a demo. */
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  /**
   * Close, and hand focus back to the toggle. Closing alone strands the
   * keyboard: the panel goes `inert`, the browser blurs whatever was inside it,
   * and focus lands on `<body>` — so Escape on a menu link silently drops the
   * user at the top of the document.
   *
   * Only for keyboard dismissal. A pointer dismissal is left alone: the browser
   * moves focus to whatever was clicked, which is where that user asked to be,
   * and the guard below covers the case where focus is already elsewhere.
   */
  function dismissToButton() {
    setOpen(false);
    if (rootRef.current?.contains(document.activeElement)) {
      buttonRef.current?.focus();
    }
  }

  // Close on a route change — chiefly the back button, since the links below
  // already close on click. Adjusted during render rather than in an effect so
  // the panel never paints open on the new route (a same-page hash link like
  // "/#how-it-works" doesn't change the pathname, hence the click handler too).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismissToButton();
    }
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-full border border-line bg-surface/85 text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {/* Anchored to the header bar, which is the nearest positioned ancestor. */}
      <div
        id={panelId}
        className={clsx(
          "absolute inset-x-0 top-full origin-top transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        )}
        inert={!open}
      >
        {/* Opaque like the bar above it, and `bg-ink` rather than the bar's
            `bg-surface`: the panel hangs over the page, so it reads as a layer
            dropped onto it rather than a continuation of the header. */}
        <div className="border-b border-line bg-ink px-6 py-3 shadow-lg shadow-cast/20">
          <ul className="flex flex-col items-center">
            {/* Home leads, and reads like the rest of the list — it's the top of
                the site, not an action. Only rendered below `sm`, where the bar
                drops it. */}
            <li className="sm:hidden">
              <Link
                href={home.href}
                onClick={() => setOpen(false)}
                className="block py-2.5 text-center text-[15px] text-muted transition-colors hover:text-ivory"
              >
                {home.label}
              </Link>
            </li>

            {items.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-2.5 text-center text-[15px] text-muted transition-colors hover:text-ivory"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* The invitation wears the same chip it wears in the bar, rather than
              flattening into a list item — it's an offer, not a destination.
              Never the exit: that stays in the bar at every width. */}
          {demo && (
            <div className="mt-2 flex justify-center pb-1 sm:hidden">
              <DemoInvite
                className="inline-flex"
                onClick={() => setOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
