import type { CategoryScore, CheckResult, Scorecard } from "../types.js";

export interface MarkdownOptions {
  name?: string;
  /** Heading level for the report title (default 3 → `###`). */
  level?: number;
}

function gradeEmoji(grade: string): string {
  if (grade.startsWith("A")) return "🟢";
  if (grade.startsWith("B")) return "🔵";
  if (grade.startsWith("C")) return "🟡";
  return "🔴";
}

function statusMark(status: string): string {
  return status === "fail" ? "✗" : status === "warn" ? "⚠" : "✓";
}

function categoryRow(cat: CategoryScore): string {
  if (!cat.evaluated) return `| ${cat.label} | — | _not scored_ |`;
  const summary = cat.failCount > 0 ? `✗ ${cat.failCount}` : cat.warnCount > 0 ? `⚠ ${cat.warnCount}` : "✓";
  return `| ${cat.label} | ${Math.round(cat.score as number)} | ${summary} |`;
}

function fixLine(r: CheckResult): string {
  const ev = r.evidence[0];
  const loc = ev?.line ? `\`${ev.file}:${ev.line}\`` : ev?.file ? `\`${ev.file}\`` : "";
  const detail = ev?.message ?? "";
  const fix = r.fix ? `\n  - _Fix:_ ${r.fix}` : "";
  return `- ${statusMark(r.status)} **${r.id}** ${r.title} — ${loc} ${detail}${fix}`;
}

/** Render a Scorecard as a Markdown report — for PR comments and issues. */
export function renderMarkdown(card: Scorecard, opts: MarkdownOptions = {}): string {
  const name = opts.name ?? "artifact";
  const h = "#".repeat(Math.max(1, Math.min(6, opts.level ?? 3)));
  const mode = card.categories.find((c) => c.key === "triggering")?.evaluated ? "LLM-assisted" : "deterministic";

  const lines: string[] = [];
  lines.push(`${h} ${gradeEmoji(card.grade)} Beacon: ${card.grade} — \`${name}\``);
  lines.push("");
  lines.push(`**Overall ${card.overall}/100** · rubric v${card.rubricVersion} · ${mode}`);
  lines.push("");
  lines.push("| Category | Score | |");
  lines.push("|---|---:|---|");
  for (const cat of card.categories) lines.push(categoryRow(cat));
  lines.push("");

  const fixes = card.results
    .filter((r) => r.status !== "pass")
    .sort((a, b) => (a.status !== b.status ? (a.status === "fail" ? -1 : 1) : a.score - b.score));
  if (fixes.length > 0) {
    lines.push("**Top fixes**");
    lines.push("");
    for (const r of fixes) lines.push(fixLine(r));
  } else {
    lines.push("✓ **Clean scan** — no warnings or failures.");
  }
  return lines.join("\n");
}
