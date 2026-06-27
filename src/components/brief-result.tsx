import { clsx } from "@/lib/cn";
import type { BriefItem, BriefResult, Evidence } from "@/types/brief";

/**
 * Renders a real generated brief (#9). Every claim links to its source;
 * empty sections and thin-evidence briefs degrade gracefully.
 */

type Tone = "default" | "risk" | "signal";

function SectionLabel({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span
        className={clsx(
          "size-1.5 rounded-full",
          tone === "risk" && "bg-risk shadow-[0_0_8px_var(--color-risk)]",
          tone === "signal" && "bg-signal shadow-[0_0_8px_var(--color-signal)]",
          tone === "default" && "bg-accent shadow-[0_0_8px_var(--color-accent)]",
        )}
      />
      <h4 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        {children}
      </h4>
    </div>
  );
}

function Cite({
  ids,
  numbering,
  evidence,
}: {
  ids: string[];
  numbering: Map<string, number>;
  evidence: Map<string, Evidence>;
}) {
  return (
    <sup className="ml-0.5 whitespace-nowrap align-super">
      {ids.map((id) => {
        const n = numbering.get(id);
        const ev = evidence.get(id);
        if (!n || !ev) return null;
        return (
          <a
            key={id}
            href={ev.sourceUrl}
            target="_blank"
            rel="noreferrer"
            title={ev.sourceTitle}
            className="ml-0.5 text-[10px] font-medium text-accent transition-colors hover:text-accent-strong"
          >
            [{n}]
          </a>
        );
      })}
    </sup>
  );
}

function Section({
  title,
  tone,
  items,
  numbering,
  evidence,
}: {
  title: string;
  tone: Tone;
  items: BriefItem[];
  numbering: Map<string, number>;
  evidence: Map<string, Evidence>;
}) {
  if (items.length === 0) {
    return (
      <section>
        <SectionLabel tone={tone}>{title}</SectionLabel>
        <p className="text-[13px] italic text-faint">Nothing notable found.</p>
      </section>
    );
  }
  return (
    <section>
      <SectionLabel tone={tone}>{title}</SectionLabel>
      <ul className="space-y-2.5 text-[13.5px] leading-relaxed text-ivory/90">
        {items.map((item, i) => (
          <li key={i}>
            {item.text}
            <Cite ids={item.citations} numbering={numbering} evidence={evidence} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BriefResultView({ result }: { result: BriefResult }) {
  const { brief, entity, evidence, meta, input } = result;

  const numbering = new Map<string, number>();
  const evidenceById = new Map<string, Evidence>();
  evidence.forEach((e, i) => {
    numbering.set(e.id, i + 1);
    evidenceById.set(e.id, e);
  });

  const totalItems =
    brief.talkingPoints.length +
    brief.decisionAsks.length +
    brief.riskAlerts.length +
    brief.buyingSignals.length;

  const personLine = entity.person.role
    ? `${entity.person.name} · ${entity.person.role}`
    : entity.person.name;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-glow opacity-50 blur-2xl" />

      <article className="relative overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-surface/80 shadow-2xl shadow-black/40 backdrop-blur-sm">
        {/* header */}
        <header className="border-b border-line px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                Meeting brief
              </p>
              <h3 className="mt-1 font-display text-2xl font-semibold text-ivory">
                {entity.company.name}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {personLine} · {input.context}
              </p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="font-mono text-2xl font-semibold text-signal">
                {evidence.length}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
                sources
              </p>
            </div>
          </div>

          {(brief.snapshot || brief.objective) && (
            <div className="mt-4 space-y-1.5">
              {brief.snapshot && (
                <p className="text-[13.5px] text-ivory/90">{brief.snapshot}</p>
              )}
              {brief.objective && (
                <p className="text-[13px] text-muted">
                  <span className="text-faint">Objective — </span>
                  {brief.objective}
                </p>
              )}
            </div>
          )}
        </header>

        {/* thin-evidence note */}
        {totalItems === 0 && (
          <div className="border-b border-line px-6 py-4">
            <p className="text-[13px] text-muted">
              Limited public signal found for{" "}
              <span className="text-ivory">{entity.company.name}</span>. Try a more
              specific company name, or add a domain in the company field.
            </p>
          </div>
        )}

        {/* body */}
        {totalItems > 0 && (
          <div className="grid gap-6 px-6 py-6 sm:grid-cols-2">
            <Section
              title="Talking points"
              tone="default"
              items={brief.talkingPoints}
              numbering={numbering}
              evidence={evidenceById}
            />
            <Section
              title="Decision asks"
              tone="default"
              items={brief.decisionAsks}
              numbering={numbering}
              evidence={evidenceById}
            />
            <Section
              title="Risk alerts"
              tone="risk"
              items={brief.riskAlerts}
              numbering={numbering}
              evidence={evidenceById}
            />
            <Section
              title="Buying signals"
              tone="signal"
              items={brief.buyingSignals}
              numbering={numbering}
              evidence={evidenceById}
            />
          </div>
        )}

        {/* sources */}
        {evidence.length > 0 && (
          <div className="border-t border-line px-6 py-5">
            <SectionLabel>Sources</SectionLabel>
            <ol className="space-y-1.5">
              {evidence.map((e, i) => (
                <li key={e.id} className="flex gap-2 text-[12px] leading-relaxed">
                  <span className="font-mono text-faint">[{i + 1}]</span>
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-ivory"
                  >
                    {e.sourceTitle}
                  </a>
                  <span className="font-mono text-faint">· {e.tool}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* meta footer */}
        <footer className="flex items-center justify-between border-t border-line px-6 py-3">
          <p className="font-mono text-[11px] text-faint">
            {meta.model} · {(meta.elapsedMs / 1000).toFixed(1)}s
          </p>
          <p className="font-mono text-[11px] text-faint">
            every claim cited
          </p>
        </footer>
      </article>
    </div>
  );
}
