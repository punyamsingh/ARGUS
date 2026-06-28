import type { BriefItem, BriefResult, Evidence } from "@/types/brief";

/**
 * Serialise a generated brief to clean, portable Markdown — for the copy and
 * download actions. Every claim keeps its `[n]` citation, and a numbered
 * Sources list maps each `[n]` to its URL, so the exported brief stays as
 * grounded on paper as it is on screen.
 */
export function briefToMarkdown(result: BriefResult): string {
  const { brief, entity, evidence, meta, input } = result;

  // Stable numbering, matching the on-screen brief.
  const numbering = new Map<string, number>();
  evidence.forEach((e, i) => numbering.set(e.id, i + 1));

  const cites = (item: BriefItem) => {
    const ns = item.citations
      .map((id) => numbering.get(id))
      .filter((n): n is number => typeof n === "number");
    return ns.length ? ` ${ns.map((n) => `[${n}]`).join("")}` : "";
  };

  const section = (title: string, items: BriefItem[]) => {
    if (items.length === 0) return "";
    const lines = items.map((it) => `- ${it.text}${cites(it)}`);
    return `### ${title}\n${lines.join("\n")}\n`;
  };

  const personLine = entity.person.role
    ? `${entity.person.name} · ${entity.person.role}`
    : entity.person.name;

  const out: string[] = [];
  out.push(`# Meeting brief — ${entity.company.name}`);
  out.push(`**${personLine}** · ${input.context}`);
  if (brief.snapshot) out.push(`\n${brief.snapshot}`);
  if (brief.objective) out.push(`\n**Objective —** ${brief.objective}`);

  const body = [
    section("Talking points", brief.talkingPoints),
    section("Decision asks", brief.decisionAsks),
    section("Risk alerts", brief.riskAlerts),
    section("Buying signals", brief.buyingSignals),
  ]
    .filter(Boolean)
    .join("\n");
  if (body) out.push(`\n${body}`);

  if (evidence.length > 0) {
    out.push("### Sources");
    out.push(sourcesList(evidence));
  }

  out.push(
    `\n---\n_${evidence.length} sources · ${meta.model} · generated ${meta.generatedAt}_`,
  );

  return out.join("\n").trim() + "\n";
}

function sourcesList(evidence: Evidence[]): string {
  return evidence
    .map((e, i) => `${i + 1}. [${e.sourceTitle}](${e.sourceUrl}) — ${e.tool}`)
    .join("\n");
}
