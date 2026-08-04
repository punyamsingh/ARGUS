"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "@/lib/cn";

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
  cta,
}: {
  items: NavLink[];
  /** The header's primary action, which does not fit in the bar below `sm`. */
  cta: NavLink;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

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
      if (e.key === "Escape") setOpen(false);
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
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-full border border-line bg-surface/60 text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
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
        {/* Opaque, not `.glass`: the header bar can afford to be translucent
            because text only passes behind it, but the hero copy read straight
            through this panel's own links. */}
        <div className="border-b border-line bg-ink px-6 py-3 shadow-lg shadow-cast/20">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-2.5 text-[15px] text-muted transition-colors hover:text-ivory"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Only rendered below `sm`, where the header bar drops the CTA. */}
          <Link
            href={cta.href}
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-accent-strong sm:hidden"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
