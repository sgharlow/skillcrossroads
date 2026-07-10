#!/usr/bin/env node
/**
 * "State of Claude Code Skills" data report generator (Build Bible Sprint 4 public artifact).
 *
 * Batch-scans public skill repos with Skill Crossroads and writes a markdown report of the aggregate findings.
 *
 *   npm run build && node scripts/state-of-skills.mjs [owner/repo ...]
 *
 * Two editions:
 *  - DETERMINISTIC (default): structure/token/safety checks only — pure, free, bit-reproducible
 *    from the pinned git tree shas.
 *  - FULL (set BEACON_LLM=1 + ANTHROPIC_API_KEY): also runs the LLM triggering check (TRIGGER-01),
 *    so the report can measure the ecosystem's #1 real-world failure — "my skill never fires."
 *    Verdicts are content-hash cached and pinned to tree shas, but LLM output is not bit-reproducible.
 *
 * Env: GITHUB_TOKEN (higher rate limits), BEACON_LLM=1 (+ ANTHROPIC_API_KEY, BEACON_MODEL),
 *      BEACON_MAX_PER_REPO (default 12), BEACON_MAX_TOTAL (default 260).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  scanGitHubRepo,
  createAnthropicClient,
  createAnthropicTokenCounter,
  createFileCache,
} from "../packages/core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));

/** A curated, real, public sample: the well-maintained baseline plus a spread of community repos. */
const DEFAULT_REPOS = [
  "anthropics/skills",
  "diegosouzapw/awesome-omni-skill",
  "lionelsimai/claude-skills-collection",
  "membranedev/application-skills",
  "Trompetilla/Skills",
  "LeoYeAI/openclaw-master-skills",
  "ComeOnOliver/skillshub",
  "agentskillexchange/skills",
  "ranbot-ai/awesome-skills",
  "inbharatai/claude-skills",
  "onfire7777/universal-ai-skills-library",
  "FridrichMethod/awesome-skills",
  "rootcastleco/rei-skills",
  "itsmostafa/aws-agent-skills",
  "kid-sid/claude-spellbook",
  "Cortexa-LLC/ai-pack",
  "Sandeeprdy1729/skill_galaxy",
  "excatt/superclaude-plusplus",
];

const posNum = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const REPOS = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_REPOS;
const token = process.env.GITHUB_TOKEN;
const maxPerRepo = posNum(process.env.BEACON_MAX_PER_REPO, 12);
const maxTotal = posNum(process.env.BEACON_MAX_TOTAL, 260);

// Optional LLM edition: enables the triggering check so we can measure "will it fire?".
const useLlm = Boolean(process.env.BEACON_LLM) && Boolean(process.env.ANTHROPIC_API_KEY);
// Count LLM checks dropped on model/network errors — so the report can DISCLOSE coverage rather than
// silently computing a headline over an undisclosed surviving fraction.
const dropped = {};
let ctx = {};
if (useLlm) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.BEACON_MODEL;
  ctx = {
    model: createAnthropicClient({ apiKey, model }),
    tokenCounter: createAnthropicTokenCounter({ apiKey, model }),
    cache: createFileCache(),
    onError: (id, err) => {
      dropped[id] = (dropped[id] ?? 0) + 1;
      process.stderr.write(`    ${id} skipped: ${err instanceof Error ? err.message : err}\n`);
    },
  };
  process.stderr.write(`LLM edition ON (model ${model ?? "default"}) — triggering will be scored.\n`);
} else {
  process.stderr.write("Deterministic edition (set BEACON_LLM=1 + ANTHROPIC_API_KEY for the triggering hook).\n");
}

const DET_LABELS = {
  "STRUCT-01": "valid YAML frontmatter",
  "STRUCT-02": "recommended fields present",
  "STRUCT-05": "supporting-file references resolve",
  "TOKEN-01": "under the line/token budget",
  "TOKEN-02": "progressive disclosure",
  "TOKEN-03": "description budget footprint",
  "CLARITY-03": "no ASCII-art / persona filler",
  "SAFETY-01": "no hardcoded secrets",
  "SAFETY-02": "allowed-tools least-privilege",
  "SAFETY-03": "no destructive auto-invocation",
  "SAFETY-04": "no shell-injection in ! blocks",
};
const LLM_LABELS = useLlm
  ? {
      "TRIGGER-01": "description triggers reliably",
      "CLARITY-05": "constraints & failure modes stated",
      "VERIFY-04": "verification step present",
    }
  : {};
const CHECK_LABELS = { ...DET_LABELS, ...LLM_LABELS };

const scanned = [];
let running = 0;
for (const repo of REPOS) {
  if (running >= maxTotal) {
    process.stderr.write(`(reached BEACON_MAX_TOTAL=${maxTotal} — skipping remaining repos)\n`);
    break;
  }
  process.stderr.write(`scanning ${repo} …\n`);
  try {
    // Hard total cap: never let the final repo overshoot BEACON_MAX_TOTAL.
    const repoMax = Math.max(1, Math.min(maxPerRepo, maxTotal - running));
    const scan = await scanGitHubRepo(repo, ctx, { token, maxContentFiles: 8, max: repoMax });
    scanned.push({ repo, scan });
    running += scan.skills.length;
    process.stderr.write(
      `  ${scan.skills.length} skills, ${scan.errors.length} errors (tree ${scan.treeSha.slice(0, 10)}) — running total ${running}\n`,
    );
  } catch (err) {
    process.stderr.write(`  ✗ ${repo}: ${err instanceof Error ? err.message : err}\n`);
    scanned.push({ repo, scan: { ref: "?", treeSha: "?", skills: [], errors: [{ repoPath: repo, message: String(err) }] } });
  }
}

const skills = scanned.flatMap((s) => s.scan.skills);
const total = skills.length;
if (total === 0) {
  process.stderr.write("No skills scanned — aborting.\n");
  process.exit(1);
}

const buckets = { A: 0, B: 0, C: 0, D: 0, F: 0 };
for (const s of skills) buckets[s.scorecard.grade[0]] = (buckets[s.scorecard.grade[0]] ?? 0) + 1;
const avg = skills.reduce((a, s) => a + s.scorecard.overall, 0) / total;

// Per-check pass/warn/fail counts. A check only counts skills where it actually ran (LLM checks can
// be dropped on a per-skill error), so the denominator is per-check, not the whole sample.
const checkStats = {};
for (const id of Object.keys(CHECK_LABELS)) checkStats[id] = { pass: 0, warn: 0, fail: 0, ran: 0 };
for (const s of skills) {
  for (const r of s.scorecard.results) {
    if (checkStats[r.id]) {
      checkStats[r.id][r.status]++;
      checkStats[r.id].ran++;
    }
  }
}

const pctOf = (n, d) => (d === 0 ? "0%" : `${((n / d) * 100).toFixed(0)}%`);
const pct = (n) => pctOf(n, total);
const bar = (n, d = total, width = 20) => {
  const filled = d === 0 ? 0 : Math.round((n / d) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
};

const lines = [];
lines.push("# The State of Claude Code Skills");
lines.push("");
lines.push(
  `*An evidence-based audit of ${total} public Claude Code skills across ${scanned.filter((s) => s.scan.skills.length).length} repositories, graded by **Skill Crossroads** — the signpost for Claude Code artifacts.${useLlm ? " Includes the LLM-assisted triggering check." : " Deterministic checks only."} Every figure is traceable to the pinned git trees in the methodology.*`,
);
lines.push("");
lines.push(
  `> **Scope.** A deliberately mixed sample: Anthropic's well-maintained \`anthropics/skills\` catalog alongside a spread of community-authored repos (up to ${maxPerRepo} skills each). This is a read on skills people actually publish — not a curated best-of.`,
);
lines.push("");

// Headline: lead with triggering when we have it (the ecosystem's #1 real-world failure), else the worst check.
lines.push("## The headline");
lines.push("");
const trig = checkStats["TRIGGER-01"];
if (useLlm && trig && trig.ran > 0) {
  const wontFire = trig.warn + trig.fail;
  const notReached = total - trig.ran; // skills whose triggering check was dropped (model/network error)
  const coverage = trig.ran / total;
  // Coverage sentence — ALWAYS stated, so the % below can never be mistaken for a whole-sample claim.
  const covLine = `Skill Crossroads scored **${trig.ran} of ${total}** skills for triggering${
    notReached > 0 ? ` — ${notReached} could not be reached (model/network errors) and are excluded from the triggering figures` : ""
  }.`;
  if (coverage >= 0.7) {
    lines.push(
      `**Among skills Skill Crossroads could score, ${pctOf(wontFire, trig.ran)} have a description that won't reliably trigger** — ${trig.fail} (${pctOf(trig.fail, trig.ran)}) outright unlikely to fire, ${trig.warn} (${pctOf(trig.warn, trig.ran)}) borderline. "My skill never fires" is the #1 real-world skill failure, and it hides in the frontmatter \`description\`.`,
    );
    lines.push("");
    lines.push(covLine);
  } else {
    // Low coverage → do NOT lead with a bold universal number; state it as a lower-confidence sample.
    lines.push(
      `${covLine} Of those, ${pctOf(wontFire, trig.ran)} have a description that won't reliably fire (${pctOf(trig.fail, trig.ran)} unlikely, ${pctOf(trig.warn, trig.ran)} borderline). **Treat this edition's triggering figure as a lower-confidence sample** — coverage was reduced by transient errors; re-run to firm it up (cached verdicts make it cheap).`,
    );
  }
  lines.push("");
  lines.push(`The average Skill Crossroads score across all ${total} skills is **${avg.toFixed(1)}/100**.`);
} else {
  const worst = Object.entries(checkStats)
    .map(([id, c]) => ({ id, notPassing: c.warn + c.fail, ran: c.ran }))
    .filter((x) => x.ran > 0)
    .sort((a, b) => b.notPassing - a.notPassing)[0];
  lines.push(
    `Across ${total} skills, the average Skill Crossroads score is **${avg.toFixed(1)}/100**. The single most common problem is **${CHECK_LABELS[worst.id]}** (${worst.id}): **${pctOf(worst.notPassing, worst.ran)}** of skills don't cleanly pass it.`,
  );
}
lines.push("");

// Triggering deep-dive section (only when scored).
if (useLlm && trig && trig.ran > 0) {
  lines.push("## Will your skill even fire? (Triggering & Discoverability)");
  lines.push("");
  lines.push("How the LLM triggering check graded each description:");
  lines.push("");
  lines.push("```");
  lines.push(`fires reliably (pass)   ${bar(trig.pass, trig.ran)} ${pctOf(trig.pass, trig.ran).padStart(4)}  (${trig.pass})`);
  lines.push(`borderline    (warn)    ${bar(trig.warn, trig.ran)} ${pctOf(trig.warn, trig.ran).padStart(4)}  (${trig.warn})`);
  lines.push(`won't fire    (fail)    ${bar(trig.fail, trig.ran)} ${pctOf(trig.fail, trig.ran).padStart(4)}  (${trig.fail})`);
  lines.push("```");
  lines.push("");
  lines.push(
    "A description fails when it reads like a title, buries the use case, omits the natural-language phrases a user would actually say, or is so broad it never anchors. All of it is fixable **before** you publish — that's the point of the check.",
  );
  lines.push("");
}

lines.push("## Grade distribution");
lines.push("");
lines.push("| Grade | Skills | Share |");
lines.push("|---|---|---|");
for (const g of ["A", "B", "C", "D", "F"]) lines.push(`| ${g} | ${buckets[g] ?? 0} | ${pct(buckets[g] ?? 0)} |`);
lines.push("");

lines.push("## How skills do on each check");
lines.push("");
lines.push("Share of skills that **pass cleanly** (higher is better):");
lines.push("");
lines.push("```");
for (const [id, c] of Object.entries(checkStats)) {
  if (c.ran === 0) continue;
  const label = `${id} ${CHECK_LABELS[id]}`.padEnd(46);
  // n= is shown so deterministic checks (n=total) and LLM checks (smaller n, when calls were dropped)
  // are never mistaken for the same sample.
  lines.push(`${label} ${bar(c.pass, c.ran)} ${pctOf(c.pass, c.ran).padStart(4)}   n=${c.ran} (${c.warn} warn, ${c.fail} fail)`);
}
lines.push("```");
if (useLlm && trig) {
  lines.push("");
  lines.push(
    `_LLM checks (TRIGGER-01, CLARITY-05, VERIFY-04) show a smaller \`n\` than the deterministic checks when calls were dropped on transient model/network errors — each percentage is over the skills that check actually scored._`,
  );
}
lines.push("");

const labelled = (r) => CHECK_LABELS[r.id];
const fullyClean = skills.filter((s) => s.scorecard.results.filter(labelled).every((r) => r.status === "pass")).length;
const offenders = Object.entries(checkStats)
  .filter(([, c]) => c.warn + c.fail > 0)
  .sort((a, b) => b[1].warn + b[1].fail - (a[1].warn + a[1].fail))
  .map(([id, c]) => `${CHECK_LABELS[id]} (${id}): ${c.warn + c.fail} of ${c.ran}`);

lines.push("## What this means");
lines.push("");
lines.push(`**${fullyClean} of ${total} skills (${pct(fullyClean)})** pass every check Skill Crossroads ran, cleanly.`);
lines.push("");
if (offenders.length > 0) {
  lines.push("The most common defects across the sample:");
  lines.push("");
  for (const o of offenders.slice(0, 10)) lines.push(`- ${o}`);
  lines.push("");
  lines.push("Each is catchable **before** publishing, with `npx @sgharlow/beacon ./your-skill` — and each is exactly the kind of thing that makes a good skill look broken in someone else's session.");
}
lines.push("");

lines.push("## Methodology & reproducibility");
lines.push("");
lines.push(
  useLlm
    ? "Skill Crossroads' deterministic checks (no LLM) plus the LLM-assisted triggering check (TRIGGER-01) were run against each repo's git tree at the sha below. Deterministic figures are bit-reproducible from those trees; LLM verdicts are content-hash cached and pinned to the same trees, but model output is not guaranteed bit-identical across runs."
    : "Skill Crossroads' deterministic checks (no LLM) were run against each repo's git tree at the sha below. Deterministic checks are pure, so re-scanning the same tree reproduces these figures exactly. The LLM-assisted triggering check was excluded in this edition for cost and reproducibility.",
);
lines.push("");
lines.push("| Repo | Ref | Tree sha | Skills | Errors |");
lines.push("|---|---|---|---|---|");
for (const { repo, scan } of scanned) {
  lines.push(`| ${repo} | ${scan.ref} | \`${String(scan.treeSha).slice(0, 12)}\` | ${scan.skills.length} | ${scan.errors.length} |`);
}
lines.push("");
lines.push(
  `Reproduce: \`npm run build && ${useLlm ? "BEACON_LLM=1 ANTHROPIC_API_KEY=… " : ""}node scripts/state-of-skills.mjs\` (default repo set) — or pass \`owner/repo …\` to scan your own.`,
);
lines.push("");

const outDir = join(here, "..", "reports");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "state-of-claude-code-skills.md");
writeFileSync(outPath, lines.join("\n"), "utf8");
process.stderr.write(`\nWrote ${outPath} (${total} skills across ${scanned.length} repo(s))\n`);
