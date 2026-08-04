import Link from "next/link";
import { ArgusMark } from "@/components/argus-mark";
import { MobileNav } from "@/components/mobile-nav";

/**
 * `base` is the route the in-page anchors belong to — "/" normally, "/demo" on
 * the demo surface — so following "How it works" from a demo doesn't quietly
 * drop you back onto the live page. About and Contact are always absolute.
 */
export function SiteHeader({ base = "/" }: { base?: string }) {
  const anchor = base === "/" ? "/" : base;
  const NAV = [
    { label: "How it works", href: `${anchor}#how-it-works` },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];
  // Anchor-aware like NAV, so the demo surface's CTA stays on the demo.
  const CTA = { label: "Generate a brief", href: `${anchor}#studio` };

  return (
    <header id="top" className="sticky top-0 z-50 scroll-mt-0">
      <div className="glass border-b border-line/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-6 sm:gap-4">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
            <ArgusMark size={30} />
            {/* Steps down a size on the narrowest screens: at full size the
                wordmark, the CTA and the menu button no longer fit on one line
                at 390px and the CTA label broke across two. */}
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

            {/* Below `sm` the wordmark, this CTA and the menu button no longer
                fit on one line — at 360px the CTA overlapped the wordmark. It
                drops out here and leads the menu panel instead. */}
            <Link
              href={CTA.href}
              className="hidden whitespace-nowrap rounded-full border border-line bg-surface/60 px-4 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2 sm:inline-flex"
            >
              {CTA.label}
            </Link>

            {/* Below `md` the inline links above are hidden; this keeps them
                reachable from the header rather than only from the footer. */}
            <MobileNav items={NAV} cta={CTA} />
          </nav>
        </div>
      </div>
    </header>
  );
}
