import { clsx } from "@/lib/cn";
import { BriefChrome } from "@/components/brief-chrome";

/**
 * Static preview of an Argus brief — sets the visual direction for the real
 * brief UI (#9). No live data; illustrative only.
 */

function Cite({ n }: { n: number }) {
  return (
    // No `align-super`: the UA already lifts a <sup> with `top: -0.5em`, and
    // stacking `vertical-align: super` on top of that raises the marker clear of
    // its own line so it reads as belonging to the line above.
    <sup className="ml-0.5 text-[10px] font-medium text-accent">[{n}]</sup>
  );
}

function SectionLabel({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "risk" | "signal" }) {
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

export function BriefPreview({ onClose }: { onClose?: () => void }) {
  return (
    <div className="relative">
      {/* soft glow behind the card */}
      <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-glow opacity-70 blur-2xl" />

      {/* The glow above is the depth cue; the card itself stays near-opaque so
          the background canvas never crosses the brief's own body text. */}
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-surface/95 shadow-2xl shadow-cast/40 backdrop-blur-md">
        <BriefChrome
          status="ready · 38s"
          onClose={
            onClose ? { label: "Dismiss example", onClick: onClose } : undefined
          }
        />

        {/* brief header */}
        <div className="border-b border-line px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                Meeting brief
              </p>
              <h3 className="mt-1 font-display text-2xl font-semibold text-ivory">
                Northwind Logistics
              </h3>
              <p className="mt-1 text-sm text-muted">
                Priya Menon · VP Revenue Operations · renewal + expansion call
              </p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="font-mono text-2xl font-semibold text-signal">5</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
                sources
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["News", "SEC EDGAR", "Greenhouse", "Wikipedia", "GDELT"].map((s) => (
              <span
                key={s}
                className="rounded-full border border-line bg-ink-2 px-2.5 py-1 font-mono text-[10px] text-muted"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* body */}
        <div className="grid gap-6 px-6 py-6 sm:grid-cols-2">
          <section>
            <SectionLabel>Talking points</SectionLabel>
            <ul className="space-y-2.5 text-[13.5px] leading-relaxed text-ivory/90">
              <li>
                Q3 shipping volume up 22% YoY — lead with capacity, not price.<Cite n={1} />
              </li>
              <li>
                New Chennai DC opened last month; their ops team is scaling fast.<Cite n={2} />
              </li>
            </ul>
          </section>

          <section>
            <SectionLabel>Decision asks</SectionLabel>
            <ul className="space-y-2.5 text-[13.5px] leading-relaxed text-ivory/90">
              <li>Push for a 24-month renewal ahead of their fiscal close.<Cite n={3} /></li>
              <li>Introduce the analytics add-on to the new ops hires.</li>
            </ul>
          </section>

          <section>
            <SectionLabel tone="risk">Risk alerts</SectionLabel>
            <ul className="space-y-2.5 text-[13.5px] leading-relaxed text-ivory/90">
              <li>
                Soft Q3 earnings; CFO flagged cost discipline on the call.<Cite n={4} />
              </li>
            </ul>
          </section>

          <section>
            <SectionLabel tone="signal">Buying signals</SectionLabel>
            <ul className="space-y-2.5 text-[13.5px] leading-relaxed text-ivory/90">
              <li>
                14 open roles in ops &amp; data — active expansion.<Cite n={2} />
              </li>
              <li>Filed a Form D raise in March.<Cite n={5} /></li>
            </ul>
          </section>
        </div>

        {/* footer sources */}
        <div className="flex items-center justify-between border-t border-line px-6 py-3">
          <p className="font-mono text-[11px] text-faint">5 sources · every signal cited</p>
          <p className="font-mono text-[11px] text-faint">prep time · 45 min → 38 sec</p>
        </div>
      </div>
    </div>
  );
}
