import type { Metadata } from "next";
import { PageShell, Section } from "@/components/page-shell";
import { ContactForm } from "@/components/contact-form";

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "punyamsingh04@gmail.com";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to Team Argus — product feedback, a brief that came back wrong, rolling Argus out to a sales team, or research and partnership questions.",
};

const REASONS = [
  {
    title: "Product feedback",
    body: "You used a brief in a real meeting and something helped — or something got in the way. This is the most useful message you can send us.",
  },
  {
    title: "A brief came back wrong",
    body: "Wrong entity, stale news, a citation that doesn't support its claim. Tell us the company and person you searched for and we can reproduce it.",
  },
  {
    title: "Using Argus with a team",
    body: "You run a sales team and want to try this on real accounts. We're interested in how your prep actually works today.",
  },
  {
    title: "Research or partnership",
    body: "Academic, journalistic, or a data source you think belongs in the tool belt.",
  },
];

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title={
        <>
          Talk to <span className="text-gleam italic">Team Argus</span>.
        </>
      }
      lede="We read everything that comes in — product feedback, a brief that came back wrong, or a team that wants to run Argus on real accounts. Expect a reply within two working days."
    >
      <Section title="Send us a message">
        <ContactForm email={CONTACT_EMAIL} />
        <p className="text-[14px]">
          Prefer your own client? Write to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[Argus] Hello")}`}
            className="text-accent underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="What people usually write about">
        <div className="grid gap-4 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <div
              key={reason.title}
              className="rounded-2xl border border-line bg-surface/40 p-5 transition-colors hover:border-line-strong"
            >
              <h3 className="font-display text-lg font-semibold text-ivory">
                {reason.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                {reason.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Reporting a bug">
        <p>
          Send it straight to us with the details that make it reproducible: the
          company and person you searched for, the meeting context you gave, and
          what came back wrong. Screenshots help. We triage bug reports ahead of
          everything else in the inbox.
        </p>
      </Section>

      <Section title="Privacy of what you send">
        <p>
          The form on this page drafts a message in your own mail client; nothing
          is transmitted to us until you press send. We use what you send only to
          answer you and to fix what you reported.
        </p>
      </Section>
    </PageShell>
  );
}
