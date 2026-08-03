import Link from "next/link";
import { ArgusMark } from "@/components/argus-mark";

const LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-start sm:justify-between sm:gap-12">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/" className="flex items-center gap-2.5">
              <ArgusMark size={26} />
              <span className="font-display text-[15px] font-semibold tracking-[0.14em]">
                <span className="text-ivory">ARGUS</span>
                <span className="text-nova font-extrabold italic">NOVA</span>
              </span>
            </Link>
            <span className="text-[11px] text-faint">
              <span className="text-accent">A</span>gentic{" "}
              <span className="text-accent">R</span>esearch{" "}
              <span className="text-accent">G</span>enerated to{" "}
              <span className="text-accent">U</span>nburden{" "}
              <span className="text-accent">S</span>alespeople
            </span>
          </div>

          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted">
            Pre-meeting intelligence for sellers. One cited, conversation-ready
            brief — synthesised from real-time public signals in the minutes
            before your meeting.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-4 sm:items-end">
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            {LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-muted transition-colors hover:text-ivory"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3.5 py-1.5 font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <MailIcon />
              Talk to the team
            </Link>
          </nav>

          <span className="text-[12px] text-faint">
            © {new Date().getFullYear()} Team Argus
          </span>
        </div>
      </div>
    </footer>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="size-3.5 text-accent"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" />
    </svg>
  );
}
