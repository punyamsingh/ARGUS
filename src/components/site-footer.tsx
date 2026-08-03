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
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 sm:flex-row sm:justify-between">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <ArgusMark size={28} />
            <span className="font-display text-base font-semibold tracking-[0.14em]">
              <span className="text-ivory">ARGUS</span>
              <span className="text-nova font-extrabold italic">NOVA</span>
            </span>
          </Link>

          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted">
            Pre-meeting intelligence for sellers. One cited,
            conversation-ready brief — synthesised from real-time public signals
            in the minutes before your meeting.
          </p>

          <p className="mt-4 text-[12px] text-faint">
            <span className="text-accent">A</span>gentic{" "}
            <span className="text-accent">R</span>esearch{" "}
            <span className="text-accent">G</span>enerated to{" "}
            <span className="text-accent">U</span>nburden{" "}
            <span className="text-accent">S</span>alespeople
          </p>

          <Link
            href="/contact"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
          >
            <MailIcon />
            Talk to the team
          </Link>
        </div>

        <div className="flex flex-col justify-between gap-8 sm:items-end">
          <nav aria-label="Footer" className="flex flex-col gap-2.5 text-[14px] sm:items-end">
            {LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-muted transition-colors hover:text-ivory"
              >
                {link.label}
              </Link>
            ))}
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
