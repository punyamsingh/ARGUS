/**
 * The standard body for every non-landing page (About, Contact, legal). Keeps
 * the background layers and the editorial page header in one place so those
 * routes stay visually identical to the landing page. The site header and
 * footer wrap this from the root layout.
 */
export function PageShell({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex-1">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-glow" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid" />

      {/* One reading column, as before — it just starts at the page's left
            gutter, in line with the header, instead of floating mid-window. */}
      <div className="shell pb-24 pt-16">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-[2.2rem] font-semibold leading-[1.1] tracking-tight text-ivory sm:text-5xl">
            {title}
          </h1>
          {lede ? (
            <p className="mt-5 text-lg leading-relaxed text-muted">{lede}</p>
          ) : null}

          <div className="mt-12">{children}</div>
        </div>
      </div>
    </main>
  );
}

/** A titled block within a `PageShell` body. */
export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-line py-10 first:border-t-0 first:pt-0"
    >
      <h2 className="font-display text-xl font-semibold text-ivory">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}
