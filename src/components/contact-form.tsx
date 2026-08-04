"use client";

import { useState } from "react";
import { DISABLED_PRIMARY } from "@/lib/button";

/**
 * Contact form. Rather than posting to a mail backend, the form composes a
 * well-formed message and hands it to the visitor's own mail client — nothing
 * is transmitted or stored by us until the visitor sends it themselves.
 */

/**
 * Cap on the message field. Mail clients and browsers impose their own limits
 * on `mailto:` URL length and truncate silently past them, so we bound the
 * message and show the remaining count rather than let a long note get cut.
 */
const MESSAGE_MAX = 2000;

const TOPICS = [
  "Product feedback",
  "Using Argus with my team",
  "Bug or wrong output",
  "Partnership or research",
  "Something else",
];

export function ContactForm({ email }: { email: string }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const subject = `[Argus] ${topic}`;
  const body = [
    message.trim(),
    "",
    "—",
    name.trim() ? `From: ${name.trim()}` : "",
    from.trim() ? `Reply to: ${from.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const mailto = `mailto:${email}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form
      className="rounded-[var(--radius-card)] border border-line bg-surface/40 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = mailto;
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Okafor"
            autoComplete="name"
            className={inputClass}
          />
        </Field>

        <Field label="Your email">
          <input
            type="email"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="jane@company.com"
            autoComplete="email"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Topic">
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={inputClass}
          >
            {TOPICS.map((t) => (
              <option key={t} value={t} className="bg-surface">
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Message">
          <textarea
            required
            rows={5}
            maxLength={MESSAGE_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind? If it's about a brief, the company and person you searched for helps us reproduce it."
            className={`${inputClass} resize-y`}
          />
        </Field>
        <p className="mt-1.5 text-right text-[11px] tabular-nums text-faint">
          {message.length} / {MESSAGE_MAX}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          className={`inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-accent px-5 py-2 text-[14px] font-semibold text-ink transition-colors hover:bg-accent-strong ${DISABLED_PRIMARY}`}
          disabled={!message.trim()}
        >
          Open in my mail app
        </button>
        <button
          type="button"
          onClick={copyEmail}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface/60 px-5 py-2 text-[14px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
        >
          {copied ? "Address copied ✓" : "Copy email address"}
        </button>
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-faint">
        {message.trim()
          ? null
          : "Write a message to enable the mail-app button. "}
        This form doesn&apos;t send anything on its own — it drafts the message in
        your own mail client, so nothing you type here reaches us until you press
        send.
      </p>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-ink-2/60 px-3.5 py-2.5 text-[14px] text-ivory placeholder:text-faint transition-colors hover:border-line-strong focus:border-line-strong focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}
