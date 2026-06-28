"use client";

import { useState } from "react";
import type { BriefResult } from "@/types/brief";
import { briefToMarkdown } from "@/lib/brief-markdown";

/**
 * Action bar for a generated brief — get it out of the screen and into the
 * meeting: copy as Markdown, download a `.md`, or print (a `@media print`
 * stylesheet renders the brief clean). Self-contained; no API calls.
 */
export function BriefActions({ result }: { result: BriefResult }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(briefToMarkdown(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked (insecure context / permissions) — no-op
    }
  }

  function download() {
    const md = briefToMarkdown(result);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const slug = result.entity.company.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `argus-brief-${slug || "company"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <ActionButton onClick={copy}>
        {copied ? "Copied ✓" : "Copy Markdown"}
      </ActionButton>
      <ActionButton onClick={download}>Download .md</ActionButton>
      <ActionButton onClick={() => window.print()}>Print</ActionButton>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      {children}
    </button>
  );
}
