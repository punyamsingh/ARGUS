import Link from "next/link";
import { ArgusMark } from "@/components/argus-mark";

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

  return (
    <header id="top" className="sticky top-0 z-50 scroll-mt-0">
      <div className="glass border-b border-line/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/" className="group flex items-center gap-3">
            <ArgusMark size={30} />
            <span className="font-display text-lg font-semibold tracking-[0.14em]">
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

            <Link
              href={`${anchor}#studio`}
              className="rounded-full border border-line bg-surface/60 px-4 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              Generate a brief
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
