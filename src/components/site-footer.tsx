import { ArgusMark } from "@/components/argus-mark";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ArgusMark size={26} animated={false} />
          <div>
            <p className="font-display text-sm font-semibold tracking-[0.14em]">
              <span className="text-ivory">ARGUS</span>
              <span className="text-nova font-extrabold italic">NOVA</span>
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              <span className="text-accent">A</span>gentic{" "}
              <span className="text-accent">R</span>esearch{" "}
              <span className="text-accent">G</span>enerated to{" "}
              <span className="text-accent">U</span>nburden{" "}
              <span className="text-accent">S</span>alespeople
            </p>
            <p className="mt-0.5 text-[12px] text-faint">
              Capstone · Product Management with Generative &amp; Agentic AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-[13px] text-muted">
          <a
            href="https://github.com/punyamsingh/ARGUS/blob/main/PLAN.md"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-ivory"
          >
            Plan
          </a>
          <a
            href="https://github.com/punyamsingh/ARGUS/issues"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-ivory"
          >
            Roadmap
          </a>
          <span className="text-faint">© {new Date().getFullYear()} Team Argus</span>
        </div>
      </div>
    </footer>
  );
}
