#!/usr/bin/env node
/**
 * "State of Claude Code Skills" data report generator (Build Bible Sprint 4 public artifact).
 *
 * Batch-scans public skill repos with Beacon's DETERMINISTIC checks (no LLM → reproducible +
 * free) and writes a markdown report of the aggregate findings. Figures are reproducible: each
 * repo's scanned git tree sha is recorded, and deterministic checks are pure.
 *
 *   npm run build && node scripts/state-of-skills.mjs [owner/repo ...]
 *
 * Env: GITHUB_TOKEN (optional, higher rate limits).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scanGitHubRepo } from "../packages/core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const REPOS = process.argv.slice(2).length ? process.argv.slice(2) : ["anthropics/skills"];
const token = process.env.GITHUB_TOKEN;

const CHECK_LABELS = {
  "STRUCT-01": "valid YAML frontmatter",
  "STRUCT-02": "recommended fields present",
  "STRUCT-05": "supporting-file references resolve",
  "TOKEN-01": "under the line/token budget",
  "CLARITY-03": "no ASCII-art / persona filler",
  "SAFETY-01": "no hardcoded secrets",
  "SAFETY-02": "allowed-tools least-privilege",
  "SAFETY-03": "no destructive auto-invocation",
  "SAFETY-04": "no shell-injection in ! blocks",
};

const scanned = [];
for (const repo of REPOS) {
  process.stderr.write(`scanning ${repo} …\n`);
  const scan = await scanGitHubRepo(repo, {}, { token, maxContentFiles: 8 });
  scanned.push({ repo, scan });
  process.stderr.write(`  ${scan.skills.length} skills, ${scan.errors.length} errors (tree ${scan.treeSha.slice(0, 10)})\n`);
}

const skills = scanned.flatMap((s) => s.scan.skills);
const total = skills.length;
if (total === 0) {
  process.stderr.write("No skills scanned — aborting.\n");
  process.exit(1);
}

// Grade distribution (by letter bucket).
const buckets = { A: 0, B: 0, C: 0, D: 0, F: 0 };
for (const s of skills) buckets[s.scorecard.grade[0]] = (buckets[s.scorecard.grade[0]] ?? 0) + 1;
const avg = skills.reduce((a, s) => a + s.scorecard.overall, 0) / total;

// Per-check pass/warn/fail counts.
const checkStats = {};
for (const id of Object.keys(CHECK_LABELS)) checkStats[id] = { pass: 0, warn: 0, fail: 0 };
for (const s of skills) {
  for (const r of s.scorecard.results) {
    if (checkStats[r.id]) checkStats[r.id][r.status]++;
  }
}

const pct = (n) => `${((n / total) * 100).toFixed(0)}%`;
const bar = (n, width = 20) => {
  const filled = Math.round((n / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
};

// Build the markdown.
const lines = [];
lines.push("# The State of Claude Code Skills");
lines.push("");
lines.push(
  `*An evidence-based audit of ${total} public Claude Code skills, graded by **Beacon** — the Lighthouse for Claude Code artifacts. Deterministic checks only; every figure below is reproducible from the pinned git trees in the methodology.*`,
);
lines.push("");
lines.push(
  `> **Scope of this edition.** These ${total} skills come from ${REPOS.length === 1 ? `the \`${REPOS[0]}\` catalog` : `${REPOS.length} repos`}. Treat this as a **baseline on well-maintained skills**, not a survey of the whole ecosystem — community-marketplace editions are the natural next report, and the same command scans any public repo.`,
);
lines.push("");

// Headline finding: the most-failed check.
const worst = Object.entries(checkStats)
  .map(([id, c]) => ({ id, notPassing: c.warn + c.fail }))
  .sort((a, b) => b.notPassing - a.notPassing)[0];
lines.push("## The headline");
lines.push("");
lines.push(
  `Across ${total} skills, the average Beacon score is **${avg.toFixed(1)}/100**. The single most common problem is **${CHECK_LABELS[worst.id]}** (${worst.id}): **${pct(worst.notPassing)}** of skills don't cleanly pass it.`,
);
lines.push("");

lines.push("## Grade distribution");
lines.push("");
lines.push("| Grade | Skills | Share |");
lines.push("|---|---|---|");
for (const g of ["A", "B", "C", "D", "F"]) {
  lines.push(`| ${g} | ${buckets[g] ?? 0} | ${pct(buckets[g] ?? 0)} |`);
}
lines.push("");

lines.push("## How skills do on each check");
lines.push("");
lines.push("Share of skills that **pass cleanly** (higher is better):");
lines.push("");
lines.push("```");
for (const [id, c] of Object.entries(checkStats)) {
  const label = `${id} ${CHECK_LABELS[id]}`.padEnd(46);
  lines.push(`${label} ${bar(c.pass)} ${pct(c.pass).padStart(4)}   (${c.warn} warn, ${c.fail} fail)`);
}
lines.push("```");
lines.push("");

// Data-driven interpretation — derived from the actual results, not hand-written claims.
const fullyClean = skills.filter((s) =>
  s.scorecard.results.filter((r) => CHECK_LABELS[r.id]).every((r) => r.status === "pass"),
).length;
const offenders = Object.entries(checkStats)
  .filter(([, c]) => c.warn + c.fail > 0)
  .map(([id, c]) => `${CHECK_LABELS[id]} (${id}): ${c.warn + c.fail} of ${total}`);

lines.push("## What this means");
lines.push("");
lines.push(`**${fullyClean} of ${total} skills (${pct(fullyClean)})** pass every deterministic check cleanly.`);
lines.push("");
if (offenders.length === 0) {
  lines.push("No deterministic defects were found in this set — a high bar, as expected for well-maintained skills. The value of an audit rises on messier, community-authored skills; that is the next edition.");
} else {
  lines.push("The defects that *did* surface, even in well-maintained skills:");
  lines.push("");
  for (const o of offenders) lines.push(`- ${o}`);
  lines.push("");
  lines.push("Each is catchable **before** publishing, with `npx beacon ./your-skill` — and each is exactly the kind of thing that makes a good skill look broken in someone else's session.");
}
lines.push("");

lines.push("## Methodology & reproducibility");
lines.push("");
lines.push(
  "Beacon's deterministic checks (no LLM) were run against each repo's git tree at the sha below. Deterministic checks are pure, so re-scanning the same tree reproduces these figures exactly. The LLM-assisted triggering check was excluded here for reproducibility and cost.",
);
lines.push("");
lines.push("| Repo | Ref | Tree sha | Skills | Errors |");
lines.push("|---|---|---|---|---|");
for (const { repo, scan } of scanned) {
  lines.push(`| ${repo} | ${scan.ref} | \`${scan.treeSha.slice(0, 12)}\` | ${scan.skills.length} | ${scan.errors.length} |`);
}
lines.push("");
lines.push("Reproduce: `npm run build && node scripts/state-of-skills.mjs " + REPOS.join(" ") + "`");
lines.push("");

const outDir = join(here, "..", "reports");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "state-of-claude-code-skills.md");
writeFileSync(outPath, lines.join("\n"), "utf8");
process.stderr.write(`\nWrote ${outPath} (${total} skills across ${scanned.length} repo(s))\n`);
