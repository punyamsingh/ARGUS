"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArgusMark } from "@/components/argus-mark";
import { AuthMenu } from "@/components/auth-menu";
import { MobileNav } from "@/components/mobile-nav";
import { useDemoInviteOffered } from "@/components/demo-fab";
import { clsx } from "@/lib/cn";
import { useInDemo } from "@/lib/demo/mode";
import { DEMO_PATH, isDemoPath } from "@/lib/demo/path";

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
  const NAV = [
    { label: "How it works", href: `${base}#how-it-works` },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];
  // Anchor-aware like NAV, so the demo surface's CTA stays on the demo.
  const CTA = { label: "Generate a brief", href: `${base}#studio` };

  // The demo control below `lg`, where the floating pill would sit on top of
  // the page's own buttons (see `DemoFab`). It rides in the bar from `sm` and
  // in the menu panel below that, where the bar is full. There's no dismiss in
  // either place — neither one covers anything — but a dismissal made on a wide
  // screen, where the pill does have one, is still honoured.
  const inDemo = useInDemo();
  const inviteOffered = useDemoInviteOffered();
  const demoLink =
    inDemo || inviteOffered
      ? {
          label: inDemo ? "Exit demo" : "Try the demo",
          href: inDemo ? "/" : DEMO_PATH,
        }
      : undefined;

  return (
    <header id="top" className="sticky top-0 z-50 scroll-mt-0">
      {/* Opaque, not `.glass`. The bar is sticky, so translucency meant the
          page's grid and glow slid around underneath it as you scrolled —
          busy behind the wordmark and the nav, and worse over a brief. */}
      <div className="border-b border-line/80 bg-surface">
        <div className="shell flex h-16 items-center justify-between gap-3 sm:gap-4">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
            <ArgusMark size={30} />
            {/* Steps down a size on the narrowest screens: at full size the
                wordmark, the CTA and the menu button no longer fit on one line
                at 390px and the CTA label broke across two. */}
            <span className="font-display text-base font-semibold tracking-[0.12em] sm:text-lg sm:tracking-[0.14em]">
              <span className="text-ivory">ARGUS</span>
              <span className="text-nova font-extrabold italic">NOVA</span>
            </span>
            {/* Held back to `lg` — that's where the demo chip beside it gives
                way to the floating pill and the bar has room again. At `sm` the
                wordmark, tagline, CTA, chip and menu button together overran
                the bar and the tagline broke across two lines. */}
            <span className="hidden whitespace-nowrap text-[13px] text-faint lg:inline">
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

            {/* Below `sm` the wordmark, this CTA and the menu button no longer
                fit on one line — at 360px the CTA overlapped the wordmark. It
                drops out here and leads the menu panel instead. */}
            <Link
              href={CTA.href}
              className="hidden whitespace-nowrap rounded-full border border-line bg-surface/85 px-4 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2 sm:inline-flex"
            >
              {CTA.label}
            </Link>

            {/* The demo control from `sm` to `lg`. Below `sm` the bar already
                carries the wordmark, the account control and the menu button,
                and a fourth item ran over the wordmark — so down there it leads
                the menu panel instead, exactly as the CTA above does. */}
            {(inDemo || inviteOffered) && (
              <Link
                href={inDemo ? "/" : DEMO_PATH}
                aria-label={inDemo ? "Exit demo mode" : "Try the demo"}
                className={clsx(
                  "hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-colors sm:flex lg:hidden",
                  inDemo
                    ? "border-accent bg-accent/15 text-accent hover:bg-accent/25"
                    : "border-line-strong bg-surface/60 text-ivory hover:border-accent hover:text-accent",
                )}
              >
                <span
                  aria-hidden="true"
                  className="relative flex size-2 shrink-0 items-center justify-center"
                >
                  {/* A live pulse inside the demo; a steady dot outside it —
                      the same tell the floating pill uses. */}
                  {inDemo && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
                  )}
                  <span className="size-2 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
                </span>
                {inDemo ? "Exit demo" : "Demo"}
              </Link>
            )}

            <AuthMenu />

            {/* Below `md` the inline links above are hidden; this keeps them
                reachable from the header rather than only from the footer. */}
            <MobileNav items={NAV} cta={CTA} demo={demoLink} />
          </nav>
        </div>
      </div>
    </header>
  );
}
