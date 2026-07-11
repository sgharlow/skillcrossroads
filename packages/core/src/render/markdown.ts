import { percentileLabel } from "../percentile.js";
import { CONFIG_FILENAME } from "../suppress.js";
import { usedLlm, type CategoryScore, type CheckResult, type Scorecard } from "../types.js";

export interface MarkdownOptions {
  name?: string;
  /** Heading level for the report title (default 3 → `###`). */
  level?: number;
}

/**
 * Escape untrusted scanned-skill text for safe inline Markdown. A scanned skill is untrusted input:
 * without this, a skill name/message like `![x](http://tracker/pixel)` or `pay | now` injects an
 * image, breaks a `</details>` block, or corrupts a table when echoed into a PR comment. Neutralizes
 * the injection-relevant characters only — raw HTML (`<>`), links/images (`[]`), code spans (`` ` ``),
 * and table pipes (`|`) — plus newlines. Leaves ordinary punctuation (hyphens, dots) intact.
 * Only for UNTRUSTED values (skill name, evidence messages, fixes) — never for Beacon's own check ids/titles.
 */
function mdText(s: string): string {
  return String(s)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[`[\]|]/g, "\\$&")
    .replace(/\s*\r?\n\s*/g, " ")
    .trim();
}

/** Escape a value shown inside a backtick code span: kill backticks (can't be backslash-escaped) + newlines. */
function mdCode(s: string): string {
  return String(s).replace(/`/g, "'").replace(/\s*\r?\n\s*/g, " ").trim();
}

/** Public: escape untrusted text for a Markdown table cell (also used by the CLI batch table). */
export function mdCell(s: string): string {
  return mdText(s);
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
  // cat.label is a fixed rubric label (trusted) — no escaping needed.
  // Structurally n/a for this kind vs a real coverage hole ("not scored").
  if (!cat.evaluated) return `| ${cat.label} | — | ${cat.applicable ? "_not scored_" : "_n/a_"} |`;
  const summary = cat.failCount > 0 ? `✗ ${cat.failCount}` : cat.warnCount > 0 ? `⚠ ${cat.warnCount}` : "✓";
  return `| ${cat.label} | ${Math.round(cat.score as number)} | ${summary} |`;
}

function fixLine(r: CheckResult): string {
  // r.id / r.title are Beacon's own constants (trusted); ev.file/message and r.fix are untrusted.
  const ev = r.evidence[0];
  const loc = ev?.line ? `\`${mdCode(ev.file)}:${ev.line}\`` : ev?.file ? `\`${mdCode(ev.file)}\`` : "";
  const detail = ev?.message ? mdText(ev.message) : "";
  const fix = r.fix ? `\n  - _Fix:_ ${mdText(r.fix)}` : "";
  return `- ${statusMark(r.status)} **${r.id}** ${r.title} — ${loc} ${detail}${fix}`;
}

/** Render a Scorecard as a Markdown report — for PR comments and issues. */
export function renderMarkdown(card: Scorecard, opts: MarkdownOptions = {}): string {
  const name = opts.name ?? "artifact";
  const h = "#".repeat(Math.max(1, Math.min(6, opts.level ?? 3)));
  const mode = usedLlm(card) ? "LLM-assisted" : "deterministic";

  const lines: string[] = [];
  lines.push(`${h} ${gradeEmoji(card.grade)} Skill Crossroads: ${card.grade} — \`${mdCode(name)}\``);
  lines.push("");
  lines.push(`**Overall ${card.overall}/100** · rubric v${card.rubricVersion} · ${mode}`);
  // Full-rubric SKILL scans only — the sample is skills; other kinds must not rank against it.
  if (!card.partial && (card.kind ?? "skill") === "skill") lines.push(`_${percentileLabel(card.overall)}_`);
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
  if (card.suppressed && card.suppressed.length > 0) {
    lines.push("");
    lines.push(
      `⚠ _${card.suppressed.length} check(s) suppressed via \`${CONFIG_FILENAME}\`: ` +
        card.suppressed.map((s) => `**${s.id}** (${mdText(s.reason)})`).join("; ") +
        `_`,
    );
  }
  return lines.join("\n");
}
