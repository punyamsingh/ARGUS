import type {
  BriefItem,
  BriefResult,
  Evidence,
  GuidanceItem,
} from "@/types/brief";

/**
 * Serialise a generated brief to clean, portable Markdown — for the copy and
 * download actions. Every claim keeps its `[n]` citation, and a numbered
 * Sources list maps each `[n]` to its URL, so the exported brief stays as
 * grounded on paper as it is on screen. All interpolated values are escaped so
 * special characters in company/person/source fields can't corrupt the output.
 */
export function briefToMarkdown(result: BriefResult): string {
  const { brief, entity, evidence, meta, input } = result;

  // Stable numbering, matching the on-screen brief.
  const numbering = new Map<string, number>();
  evidence.forEach((e, i) => numbering.set(e.id, i + 1));

  const refs = (ids: string[]) => {
    const ns = ids
      .map((id) => numbering.get(id))
      .filter((n): n is number => typeof n === "number");
    return ns.length ? ` ${ns.map((n) => `[${n}]`).join("")}` : "";
  };

  const section = (title: string, items: BriefItem[]) => {
    if (items.length === 0) return "";
    // Escape the claim text, then append our own `[n]` citations unescaped.
    const lines = items.map((it) => `- ${escapeMdText(it.text)}${refs(it.citations)}`);
    return `### ${title}\n${lines.join("\n")}\n`;
  };

  // Guidance sections reference their motivating signal via `anchors`, not citations.
  const guidanceSection = (title: string, items: GuidanceItem[]) => {
    if (items.length === 0) return "";
    const lines = items.map((it) => `- ${escapeMdText(it.text)}${refs(it.anchors)}`);
    return `### ${title}\n${lines.join("\n")}\n`;
  };

  const personLine = entity.person.role
    ? `${entity.person.name} · ${entity.person.role}`
    : entity.person.name;

  const out: string[] = [];
  out.push(`# Meeting brief — ${escapeMdText(entity.company.name)}`);
  out.push(`**${escapeMdText(personLine)}** · ${escapeMdText(input.context)}`);
  if (brief.snapshot) out.push(`\n${escapeMdText(brief.snapshot)}`);
  if (brief.objective)
    out.push(`\n**Objective —** ${escapeMdText(brief.objective)}`);

  const body = [
    section("Talking points", brief.talkingPoints),
    section("Risk alerts", brief.riskAlerts),
    section("Buying signals", brief.buyingSignals),
    guidanceSection("Decision asks", brief.decisionAsks),
    guidanceSection("Questions to ask", brief.questions),
    guidanceSection("Fit hypotheses", brief.fitHypotheses),
  ]
    .filter(Boolean)
    .join("\n");
  if (body) out.push(`\n${body}`);

  if (evidence.length > 0) {
    out.push("### Sources");
    out.push(sourcesList(evidence));
  }

  out.push(
    `\n---\n_${escapeMdText(
      `${evidence.length} sources · ${meta.model} · generated ${meta.generatedAt}`,
    )}_`,
  );

  return out.join("\n").trim() + "\n";
}

/** Render the evidence as a numbered Markdown link list, escaping titles and URLs. */
function sourcesList(evidence: Evidence[]): string {
  return evidence
    .map(
      (e, i) =>
        `${i + 1}. [${escapeMdText(e.sourceTitle)}](${escapeMdUrl(e.sourceUrl)}) — ${escapeMdText(e.tool)}`,
    )
    .join("\n");
}

/**
 * Escape Markdown-significant characters in inline text so user- or
 * source-provided values can't break headings, emphasis, links, or tables.
 * Newlines collapse to spaces to keep list items on a single line.
 */
function escapeMdText(value: string): string {
  return value.replace(/\s*\n\s*/g, " ").replace(/([\\`*_[\]<>|])/g, "\\$1");
}

/**
 * Render a URL safe for a Markdown link destination using the angle-bracket
 * form, so parentheses or spaces in the URL can't terminate the link early.
 * Any literal angle brackets are percent-encoded.
 */
function escapeMdUrl(value: string): string {
  return `<${value.replace(/[<>]/g, (c) => encodeURIComponent(c))}>`;
}
