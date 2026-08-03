import type { Metadata } from "next";
import { PageShell, Section } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Argus is, how the agent builds a cited pre-meeting brief, and who builds it.",
};

const PIPELINE = [
  {
    step: "01",
    title: "Resolve",
    body: "Turn “meeting Jane at Acme” into concrete entities — domain, ticker, filing id, job-board slug — that tools can act on.",
  },
  {
    step: "02",
    title: "Gather",
    body: "Every applicable tool fans out in parallel for real evidence. Each one times out independently and fails soft, so a single outage never sinks the brief.",
  },
  {
    step: "03",
    title: "Synthesise",
    body: "The model writes only from gathered evidence. Anything it cannot cite is dropped — thin evidence yields an honest, sparse brief rather than a fabricated one.",
  },
];

const SOURCES = [
  ["Wikipedia & Wikidata", "Entity grounding, company and person identifiers."],
  ["Company website", "Positioning, products, and recent announcements."],
  ["Job boards", "Greenhouse and Lever postings as a hiring-intent signal."],
  ["GDELT news", "Recent coverage and tone across global news."],
  ["SEC EDGAR", "Filings and disclosures for public companies."],
  ["Web search", "Fills the gaps the specialised tools do not cover."],
];

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About"
      title={
        <>
          The brief that should have existed before{" "}
          <span className="text-gleam italic">every meeting</span>.
        </>
      }
      lede="Argus is an agent, not another dashboard. It does the research in the minutes before your call and hands you the answer — cited, so you can trust it in front of a customer."
    >
      <Section title="Why it exists">
        <p>
          Preparing properly for one account meeting takes about 45 minutes of
          tab-hopping: the company site, recent news, filings, hiring pages,
          whatever your CRM happens to remember. Most reps do not have that time,
          so they walk in with a half-formed picture.
        </p>
        <p>
          Existing tools store and search data, then leave the synthesis to you.
          Argus inverts that. It runs at the last responsible moment and returns
          one screen: a snapshot, the meeting objective, talking points, decision
          asks, risk alerts, and buying signals — with a citation on every claim.
        </p>
      </Section>

      <Section id="how-it-works" title="How the agent works">
        <div className="grid gap-4 sm:grid-cols-3">
          {PIPELINE.map((p) => (
            <div
              key={p.step}
              className="rounded-2xl border border-line bg-surface/40 p-5 transition-colors hover:border-line-strong"
            >
              <span className="font-mono text-[12px] text-accent">{p.step}</span>
              <h3 className="mt-2 font-display text-lg font-semibold text-ivory">
                {p.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="sources" title="Where the evidence comes from">
        <p>
          Every source below is public and free. Nothing scraped from behind a
          login, no purchased contact data.
        </p>
        <dl className="mt-2 divide-y divide-line/70 border-y border-line/70">
          {SOURCES.map(([name, note]) => (
            <div key={name} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
              <dt className="text-[14px] font-medium text-ivory sm:w-48 sm:shrink-0">
                {name}
              </dt>
              <dd className="text-[14px] text-muted">{note}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="team" title="Who builds it">
        <p>
          Argus is built by <strong className="text-ivory">Team Argus</strong> — a
          product team working on agentic AI for revenue teams. It is scoped,
          planned, shipped and versioned like the product it is, and every release
          goes out the door the same way.
        </p>
        <p>
          Have a question, a use case, or feedback from a real sales motion? We
          would like to hear it —{" "}
          <a className="text-accent underline-offset-4 hover:underline" href="/contact">
            get in touch
          </a>
          .
        </p>
      </Section>
    </PageShell>
  );
}
