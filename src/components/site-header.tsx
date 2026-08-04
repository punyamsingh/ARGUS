"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArgusMark } from "@/components/argus-mark";
import { AuthMenu } from "@/components/auth-menu";
import { MobileNav } from "@/components/mobile-nav";
import { DemoChip } from "@/components/demo-chip";
import { DEMO_PATH, isDemoPath } from "@/lib/demo/path";
import { useInDemo } from "@/lib/demo/mode";

/**
 * Rendered once by the root layout, so no route can forget it or grow its own.
 *
 * The in-page anchors belong to whichever route you're already on — "/"
 * normally, "/demo" on the demo surface — so following "How it works" from a
 * demo doesn't quietly drop you back onto the live page. Read from the URL
 * rather than passed in: the layout doesn't know which page it's wrapping, and
 * a prop that every caller has to remember is what let the chrome drift in the
 * first place. About and Contact are always absolute.
 */
export function SiteHeader() {
  const base = isDemoPath(usePathname()) ? DEMO_PATH : "/";
  const inDemo = useInDemo();
  const NAV = [
    /**
     * Home leads, and is an ordinary nav link rather than a pill: it's the top
     * of the site, not an action, and the slot it used to sit in belonged to a
     * CTA that no longer exists.
     *
     * Anchor-aware like the rest: in a demo this is the demo's own landing page,
     * not the live one. Leaving the demo is the exit's job, and a link labelled
     * "Home" shouldn't quietly do it.
     */
    { label: "Home", href: base },
    { label: "How it works", href: `${base}#how-it-works` },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <header id="top" className="sticky top-0 z-50 scroll-mt-0">
      {/* Opaque, not `.glass`. The bar is sticky, so translucency meant the
          page's grid and glow slid around underneath it as you scrolled —
          busy behind the wordmark and the nav, and worse over a brief. */}
      <div className="border-b border-line/80 bg-surface">
        <div className="shell flex h-16 items-center justify-between gap-3 sm:gap-4">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
            <ArgusMark size={30} />
            {/* Steps down a size on the narrowest screens, where the wordmark
                shares the bar with the menu button and — in a demo — the exit
                chip, which together overflowed one line at 390px. */}
            <span className="font-display text-base font-semibold tracking-[0.12em] sm:text-lg sm:tracking-[0.14em]">
              <span className="text-ivory">ARGUS</span>
              <span className="text-nova font-extrabold italic">NOVA</span>
            </span>
            <span className="hidden text-[13px] text-faint sm:inline">
              pre-meeting intelligence
            </span>
          </Link>

          <nav className="flex items-center gap-3" aria-label="Main">
            <div className="hidden items-center gap-5 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[13px] text-muted transition-colors hover:text-ivory"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <DemoChip />

            <AuthMenu />


            {/* Below `md` the inline links above are hidden; this keeps them
                reachable from the header rather than only from the footer.
                No invitation while already inside a demo — the bar is showing
                "Exit demo", and a panel offering "Try a demo" beside it reads
                as though the demo hadn't started. */}
            <MobileNav items={NAV} demo={!inDemo} />
          </nav>
        </div>
      </div>
    </header>
  );
}
