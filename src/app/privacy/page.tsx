import type { Metadata } from "next";
import { PageShell, Section } from "@/components/page-shell";

const LAST_UPDATED = "3 August 2026";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Argus does with what you type, where briefs are stored, and which third parties are involved.",
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow={`Privacy · updated ${LAST_UPDATED}`}
      title="Privacy notice"
      lede="Argus has no accounts and no user database. This page describes, in plain terms, everything that happens to what you type."
    >
      <Section title="What you give us">
        <p>
          Three things per brief: a company, a person, and the context of your
          meeting. There is no sign-up, so we hold no name, email or password for
          you unless you choose to email us.
        </p>
      </Section>

      <Section id="data" title="Where it goes">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ivory">Our server</strong> receives your three
            inputs in order to run the agent. They are processed for the duration
            of the request and not written to a database.
          </li>
          <li>
            <strong className="text-ivory">Public data sources</strong> — Wikipedia
            and Wikidata, the company&apos;s own website, public job boards, GDELT
            news, SEC EDGAR and web search — receive queries derived from your
            inputs.
          </li>
          <li>
            <strong className="text-ivory">A model provider</strong> (Google or
            Anthropic, depending on configuration) receives the gathered evidence
            and your inputs in order to write the brief, under that
            provider&apos;s own terms.
          </li>
          <li>
            <strong className="text-ivory">Observability</strong> — when tracing is
            configured, request traces including inputs and generated briefs are
            sent to Langfuse so we can debug failures and quality issues.
          </li>
        </ul>
      </Section>

      <Section title="What stays in your browser">
        <p>
          Your recent briefs are kept in your browser&apos;s local storage so you
          can reopen them — they never leave your device. A random session
          identifier is also stored locally to group your requests in our tracing
          view; it is not tied to your identity. Clearing your browser storage
          removes both permanently.
        </p>
      </Section>

      <Section title="Cookies and analytics">
        <p>
          Argus sets no advertising or tracking cookies and runs no third-party
          analytics. The only client-side storage is the local storage described
          above.
        </p>
      </Section>

      <Section id="responsible-use" title="Responsible use">
        <p>
          Briefs describe people in their professional capacity, assembled from
          sources that are already public. Argus does not gather personal, private
          or sensitive information, and it never accesses anything behind a login.
        </p>
        <p>
          Argus is built for meeting preparation. It must not be used to profile,
          monitor or harass individuals, and its output must not be the basis for
          a decision about someone&apos;s employment, credit or similar. Briefs are
          model-generated and carry citations for a reason — verify a claim before
          you rely on it.
        </p>
        <p>
          If you are the subject of a brief and want to raise a concern,{" "}
          <a href="/contact" className="text-accent underline-offset-4 hover:underline">
            write to us
          </a>{" "}
          and we will respond.
        </p>
      </Section>

      <Section title="Retention">
        <p>
          We keep no brief content on our servers. Trace data, where enabled, is
          retained only as long as it is useful for debugging and is limited to the
          team building Argus. Email you send us is retained in our mailbox until
          the conversation is closed out.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Anything unclear, or anything you want removed —{" "}
          <a href="/contact" className="text-accent underline-offset-4 hover:underline">
            contact us
          </a>
          . If this notice changes materially, the date at the top of the page
          changes with it.
        </p>
      </Section>
    </PageShell>
  );
}
