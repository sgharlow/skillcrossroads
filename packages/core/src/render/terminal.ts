import pc from "picocolors";
import { percentileLabel } from "../percentile.js";
import { CONFIG_FILENAME } from "../suppress.js";
import type { CategoryScore, CheckResult, Evidence, Scorecard } from "../types.js";

const INNER = 63;
const LABEL_W = 26;
const BAR_W = 20;

/** Visual length in code points (we keep the box ASCII/block-only so 1 col per code point holds). */
function vlen(s: string): number {
  return [...s].length;
}

function padTo(s: string, n: number): string {
  const len = vlen(s);
  if (len > n) return `${[...s].slice(0, n - 1).join("")}…`;
  return s + " ".repeat(n - len);
}

function rightAlign(left: string, right: string, width: number): string {
  const gap = width - vlen(left) - vlen(right);
  if (gap < 1) return padTo(`${left} ${right}`, width);
  return left + " ".repeat(gap) + right;
}

function bar(score: number): string {
  const filled = Math.max(0, Math.min(BAR_W, Math.round((score / 100) * BAR_W)));
  return "█".repeat(filled) + "░".repeat(BAR_W - filled);
}

function gradeColor(grade: string): (s: string) => string {
  if (grade.startsWith("A")) return pc.green;
  if (grade.startsWith("B")) return pc.cyan;
  if (grade.startsWith("C")) return pc.yellow;
  return pc.red;
}

function statusColor(cat: CategoryScore): (s: string) => string {
  if (cat.failCount > 0) return pc.red;
  if (cat.warnCount > 0) return pc.yellow;
  return pc.green;
}

function categorySummary(cat: CategoryScore): string {
  if (cat.failCount > 0) return `${cat.failCount} fail`;
  if (cat.warnCount > 0) return `${cat.warnCount} warn`;
  return "pass";
}

function categoryRow(cat: CategoryScore): string {
  if (!cat.evaluated) {
    const content = `  ${padTo(cat.label, LABEL_W)}      ${pc.dim("not yet scored")}`;
    // pad using plain (uncolored) length
    const plain = `  ${padTo(cat.label, LABEL_W)}      not yet scored`;
    return `│${content}${" ".repeat(Math.max(0, INNER - vlen(plain)))}│`;
  }
  const s = cat.score as number;
  const scoreStr = String(Math.round(s)).padStart(3);
  const summary = categorySummary(cat);
  const plain = `  ${padTo(cat.label, LABEL_W)} ${bar(s)} ${scoreStr}  ${summary}`;
  const padded = padTo(plain, INNER);
  // Colorize the whole data row by status; padding math already done on the plain string.
  return `│${statusColor(cat)(padded)}│`;
}

function border(kind: "top" | "mid" | "bottom"): string {
  const line = "─".repeat(INNER);
  if (kind === "top") return `┌${line}┐`;
  if (kind === "bottom") return `└${line}┘`;
  return `├${line}┤`;
}

function evidenceLine(e: Evidence): string {
  const loc = e.line ? `${e.file}:${e.line}` : e.file;
  const detail = e.snippet ? `${e.message}  →  ${pc.dim(e.snippet)}` : e.message;
  return `   ${pc.dim("Evidence:")} ${loc}  ${detail}`;
}

function fixItem(r: CheckResult): string {
  const isFail = r.status === "fail";
  const mark = isFail ? pc.red("✗") : pc.yellow("⚠");
  const id = isFail ? pc.red(pc.bold(r.id)) : pc.yellow(pc.bold(r.id));
  const lines: string[] = [`${mark} ${id}  ${r.title}`];
  for (const e of r.evidence.slice(0, 3)) lines.push(evidenceLine(e));
  if (r.evidence.length > 3) lines.push(`   ${pc.dim(`… and ${r.evidence.length - 3} more`)}`);
  if (r.fix) lines.push(`   ${pc.dim("Fix:")} ${r.fix}`);
  return lines.join("\n");
}

/** Order fixes worst-first: fails before warns, then by ascending score. */
function rankFixes(results: readonly CheckResult[]): CheckResult[] {
  return results
    .filter((r) => r.status !== "pass")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "fail" ? -1 : 1;
      return a.score - b.score;
    });
}

export interface RenderOptions {
  /** A short label for the artifact (e.g. its name or directory). */
  name?: string;
  /** Force color on/off; defaults to picocolors' auto-detection. */
  color?: boolean;
}

/** Render a Scorecard as a colored terminal report. */
export function renderTerminal(card: Scorecard, opts: RenderOptions = {}): string {
  // Truncate with an ellipsis (not a bare mid-word cut) and keep a 1-space margin before the border.
  const RIGHT = INNER - 1;
  const rawName = opts.name ?? "artifact";
  const name = vlen(rawName) > 24 ? `${[...rawName].slice(0, 23).join("")}…` : rawName;
  const gc = gradeColor(card.grade);

  const llmRan = card.categories.find((c) => c.key === "triggering")?.evaluated ?? false;
  const mode = llmRan ? "LLM-assisted" : "deterministic";
  const titleRow = rightAlign("  SKILL CROSSROADS SCORECARD", name, RIGHT);
  const overallText = `  Overall: ${card.grade}  (${card.overall}/100)`;
  const overallPlain = rightAlign(overallText, `rubric v${card.rubricVersion} · ${mode}`, RIGHT);
  // Colorize just the grade token inside the already-padded overall line.
  const overallRow = overallPlain.replace(card.grade, gc(pc.bold(card.grade)));

  const lines: string[] = [];
  lines.push(border("top"));
  lines.push(`│${padTo(titleRow, INNER)}│`);
  lines.push(`│${overallRow}${" ".repeat(Math.max(0, INNER - vlen(overallPlain)))}│`);
  lines.push(border("mid"));
  for (const cat of card.categories) lines.push(categoryRow(cat));
  lines.push(border("bottom"));

  // Ecosystem context — full-rubric scans only (a partial grade vs the full-rubric sample would overstate).
  if (!card.partial) lines.push(pc.dim(`  ${percentileLabel(card.overall)}`));

  const fixes = rankFixes(card.results);
  if (fixes.length > 0) {
    lines.push("");
    lines.push(pc.bold("TOP FIXES (ranked by score impact)"));
    lines.push("");
    lines.push(fixes.map(fixItem).join("\n\n"));
  } else {
    lines.push("");
    lines.push(pc.green("No warnings or failures. Clean scan."));
  }

  if (card.partial) {
    lines.push("");
    lines.push(
      pc.dim(
        "Partial grade: some rubric categories have no checks in v0.1 and are excluded from the overall.",
      ),
    );
  }

  if (card.suppressed && card.suppressed.length > 0) {
    lines.push("");
    lines.push(
      pc.yellow(
        `${card.suppressed.length} check(s) suppressed by ${CONFIG_FILENAME}: ` +
          card.suppressed.map((s) => `${s.id} (${s.reason})`).join("; "),
      ),
    );
  }

  return lines.join("\n");
}
