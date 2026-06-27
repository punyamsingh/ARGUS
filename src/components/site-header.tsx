import Link from "next/link";
import { ArgusMark } from "@/components/argus-mark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      <div className="glass border-b border-line/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/" className="group flex items-center gap-3">
            <ArgusMark size={30} />
            <span className="font-display text-lg font-semibold tracking-[0.14em] text-ivory">
              ARGUS
            </span>
            <span className="hidden text-[13px] text-faint sm:inline">
              pre-meeting intelligence
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-[12px] text-muted md:inline-flex">
              <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
              v0 · MVP in progress
            </span>
            <a
              href="https://github.com/punyamsingh/ARGUS"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line bg-surface/60 px-4 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
