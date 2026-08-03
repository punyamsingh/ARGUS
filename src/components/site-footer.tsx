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
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <ArgusMark size={24} />
          <span className="font-display text-sm font-semibold tracking-[0.14em]">
            <span className="text-ivory">ARGUS</span>
            <span className="text-nova font-extrabold italic">NOVA</span>
          </span>
        </Link>

        <nav aria-label="Footer" className="flex items-center gap-6 text-[13px]">
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
    </footer>
  );
}
