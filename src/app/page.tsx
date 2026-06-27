import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BriefStudio } from "@/components/brief-studio";

const PIPELINE = [
  {
    step: "01",
    title: "Resolve",
    body: "Pin down exactly who and which company — the right entity, every time.",
  },
  {
    step: "02",
    title: "Gather",
    body: "A belt of specialised tools fans out in parallel for real, cited signals.",
  },
  {
    step: "03",
    title: "Synthesise",
    body: "One conversation-ready brief. Every fact grounded in a source.",
  },
];

const TOOLBELT = ["Web search", "Wikipedia", "Company site", "Wikidata"];

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="relative flex-1">
        {/* background layers */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-glow" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid" />

        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-6 pb-12 pt-16 text-center lg:pt-24">
          <span className="rise inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-[12px] text-muted">
            <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
            AI pre-meeting intelligence agent
          </span>

          <h1 className="rise mt-6 font-display text-[2.7rem] font-semibold leading-[1.05] tracking-tight text-ivory sm:text-6xl">
            Walk in already <span className="text-gleam italic">briefed</span>.
          </h1>

          <p className="rise mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted">
            Argus turns 45 minutes of scattered account research into a single,
            cited, conversation-ready brief — synthesised from real-time signals
            in the minutes before your meeting.
          </p>
        </section>

        {/* ── The studio ───────────────────────────────────── */}
        <section className="rise pb-20 [animation-delay:120ms]">
          <BriefStudio />
        </section>

        {/* ── Tool belt ────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6">
          <div className="rule" />
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-6 text-faint">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
              Grounded in
            </span>
            {TOOLBELT.map((t) => (
              <span key={t} className="text-sm text-muted">
                {t}
              </span>
            ))}
            <span className="text-sm text-faint">+ more soon</span>
          </div>
          <div className="rule" />
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ivory sm:text-4xl">
              An agent, not another dashboard.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Existing tools store and search data, then leave you to do the
              synthesis. Argus does the opposite — it works the moment before the
              meeting and hands you the answer.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {PIPELINE.map((p) => (
              <div
                key={p.step}
                className="group rounded-2xl border border-line bg-surface/40 p-6 transition-colors hover:border-line-strong hover:bg-surface/70"
              >
                <span className="font-mono text-[12px] text-accent">{p.step}</span>
                <h3 className="mt-3 font-display text-xl font-semibold text-ivory">
                  {p.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Closing line ─────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-surface/50 px-8 py-12 text-center">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-glow opacity-60" />
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ivory sm:text-4xl">
              Context, credibility, command of the room.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-muted">
              The brief that should have existed before every meeting. Built in the
              open — one issue at a time.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
