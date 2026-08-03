import type { Metadata } from "next";
import { PageShell, Section } from "@/components/page-shell";

const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const REPO = "https://github.com/punyamsingh/ARGUS";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Argus is, how the agent builds a cited pre-meeting brief, who builds it, and where the source code lives.",
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

const LINKS = [
  { label: "Source repository", href: REPO, note: "The full codebase, MIT licensed." },
  { label: "Product plan", href: `${REPO}/blob/main/PLAN.md`, note: "Where the product is heading and why." },
  { label: "Roadmap & issues", href: `${REPO}/issues`, note: "Everything being worked on, in the open." },
  { label: "Contributing guide", href: `${REPO}/blob/main/CONTRIBUTING.md`, note: "How to propose or ship a change." },
  { label: "Licence (MIT)", href: `${REPO}/blob/main/LICENSE`, note: "Use it, fork it, ship it." },
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
          Argus is built by <strong className="text-ivory">Team Argus</strong> as a
          capstone for <em>Product Management with Generative &amp; Agentic AI</em>.
          It is a real product built in the open — scoped, planned, shipped and
          versioned the way a small product team would run it, not a demo assembled
          the week before a deadline.
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

      <Section id="open-source" title="Open source">
        <p>
          The entire codebase is public under the MIT licence. Direction lives in
          the plan, work lives in issues, and every release is cut from
          conventional commits.
        </p>
        <ul className="mt-2 divide-y divide-line/70 border-y border-line/70">
          {LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-4 py-3 transition-colors hover:text-ivory"
              >
                <span>
                  <span className="text-[14px] font-medium text-ivory">
                    {link.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">
                    {link.note}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                >
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="releases" title="Releases">
        <p>
          This site is running{" "}
          <span className="font-mono text-ivory">v{version}</span>. Versions are
          derived automatically from commit history, so the number always matches
          what is deployed.
        </p>
        <a
          href={`${REPO}/blob/main/CHANGELOG.md`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
        >
          Read the changelog ↗
        </a>
      </Section>
    </PageShell>
  );
}
