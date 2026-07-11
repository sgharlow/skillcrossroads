#!/usr/bin/env node
/**
 * "State of Claude Code Agents & Commands" data report generator.
 *
 * Batch-scans public subagent/slash-command repos with Skill Crossroads and writes a markdown
 * report of the aggregate findings — the companion piece to scripts/state-of-skills.mjs, but
 * aggregating ONLY rows whose scorecard kind is "subagent" or "command".
 *
 *   npm run build && node scripts/state-of-agents.mjs [owner/repo ...]
 *
 * DETERMINISTIC edition only: structure/token/safety/correctness checks — pure, free,
 * bit-reproducible from the pinned git tree shas. No LLM checks run; the triggering figures
 * come from the deterministic description-quality checks (TRIGGER-02/03/05), not TRIGGER-01.
 *
 * Discovery matches the engine's `findArtifactFiles`: `.md` files whose PARENT directory is
 * `agents/` or `commands/` (at any depth). Repos that store agents at the repo root or in
 * category directories yield few or zero rows — those are recorded in the methodology table
 * as "no discoverable agent/command layout", never silently dropped.
 *
 * Why not `scanGitHubRepo` wholesale: its per-repo `max` budget scans SKILLS first, so a
 * mixed repo (e.g. one shipping 162 skills alongside 199 agents) would yield zero agent rows
 * under a small cap. This report is about agents/commands only, so it drives the same public
 * building blocks (`fetchRepoTree` → `findArtifactFiles` → `fetchArtifactFile` → `auditAsync`)
 * directly — identical discovery and identical grading pipeline, budget spent only on the two
 * kinds being reported.
 *
 * Env: GITHUB_TOKEN (higher rate limits), BEACON_MAX_PER_REPO (default 15),
 *      BEACON_MAX_TOTAL (default 250).
 */
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  parseGitHubUrl,
  fetchRepoTree,
  findArtifactFiles,
  fetchArtifactFile,
  auditAsync,
} from "../packages/core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));

/** A curated, real, public sample of subagent and slash-command repos. */
const DEFAULT_REPOS = [
  "VoltAgent/awesome-claude-code-subagents",
  "0xfurai/claude-code-subagents",
  "rahulvrane/awesome-claude-agents",
  "NicholasSpisak/claude-code-subagents",
  "rubenzantingh/claude-code-magento-agents",
  "rshah515/claude-code-subagents",
  "sanghun0724/awesome-swift-claude-code-subagents",
  "CoderMageFox/claudecode-codex-subagents",
  "iSerter/laravel-claude-agents",
  "mylee04/claude-code-subagents",
  "gensecaihq/Claude-Code-Subagents-Collection",
  "danielrosehill/Claude-Slash-Commands",
  "Dlaby23/claude-agents-ultimate-collection",
  "snapper-ai/claude-code-workflows",
  "wshobson/agents",
  "wshobson/commands",
  "qdhenry/Claude-Command-Suite",
];

const posNum = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const REPOS = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_REPOS;
const token = process.env.GITHUB_TOKEN;
const maxPerRepo = posNum(process.env.BEACON_MAX_PER_REPO, 15);
const maxTotal = posNum(process.env.BEACON_MAX_TOTAL, 250);

process.stderr.write(
  "Deterministic edition — no LLM checks run; triggering figures come from TRIGGER-02/03/05.\n",
);

// Check ids tracked per kind, in display order (the deterministic set that actually runs on
// each kind under rubric v1.2 — see packages/core/src/checks/index.ts).
const CHECK_LABELS = {
  "STRUCT-01": "valid YAML frontmatter",
  "STRUCT-02": "recommended fields present",
  "TOKEN-01": "under the line/token budget",
  "TOKEN-03": "description budget footprint",
  "TOKEN-04": "recurring per-invocation cost",
  "CLARITY-03": "no ASCII-art / persona filler",
  "SAFETY-01": "no hardcoded secrets",
  "SAFETY-02": "tools least-privilege",
  "SAFETY-03": "no destructive auto-invocation",
  "SAFETY-04": "no shell-injection in ! blocks",
  "AGENT-01": "declared model is valid",
  "CMD-01": "arguments and argument-hint agree",
  "TRIGGER-02": "description long enough to anchor",
  "TRIGGER-03": "invocation cues in description",
  "TRIGGER-05": "invocation flags consistent",
};
const AGENT_CHECK_IDS = [
  "STRUCT-01", "STRUCT-02", "TOKEN-01", "TOKEN-03", "TOKEN-04", "CLARITY-03",
  "SAFETY-01", "SAFETY-02", "SAFETY-03", "SAFETY-04", "AGENT-01",
  "TRIGGER-02", "TRIGGER-03", "TRIGGER-05",
];
const COMMAND_CHECK_IDS = [
  "STRUCT-01", "STRUCT-02", "TOKEN-01", "TOKEN-03", "TOKEN-04", "CLARITY-03",
  "SAFETY-01", "SAFETY-02", "SAFETY-03", "SAFETY-04", "CMD-01", "TRIGGER-05",
];

/**
 * Scan one repo's agents/commands: fetch the pinned tree, discover single-file artifacts with
 * the engine's own `findArtifactFiles`, then grade up to `repoMax` of them through the normal
 * `auditAsync` pipeline (agents first, then commands — the engine's own ordering).
 */
async function scanRepoAgentsCommands(repo, repoMax) {
  const target = parseGitHubUrl(repo);
  const tree = await fetchRepoTree(target, { token });
  const files = findArtifactFiles(tree.entries);
  const discovered = { agents: files.agents.length, commands: files.commands.length };
  // Split the per-repo cap between the two kinds when a repo ships both (agents get the larger
  // half; either kind's unused share backfills the other) so a huge agents/ dir can't crowd
  // commands out of the sample entirely, or vice versa.
  const half = Math.ceil(repoMax / 2);
  const nAgents = Math.min(files.agents.length, Math.max(half, repoMax - files.commands.length));
  const nCommands = Math.min(files.commands.length, repoMax - nAgents);
  const picked = [
    ...files.agents.slice(0, nAgents).map((p) => ({ path: p, kind: "subagent" })),
    ...files.commands.slice(0, nCommands).map((p) => ({ path: p, kind: "command" })),
  ];

  const dest = mkdtempSync(join(tmpdir(), "beacon-agents-"));
  const rows = [];
  const errors = [];
  try {
    for (const { path, kind } of picked) {
      try {
        const content = await fetchArtifactFile(target, tree.ref, path, { token });
        // Preserve the directory shape so filename-derived names (commands) stay correct.
        const localFile = join(dest, "singles", path);
        mkdirSync(join(localFile, ".."), { recursive: true });
        writeFileSync(localFile, content, "utf8");
        const res = await auditAsync(localFile, {}, kind);
        rows.push({ ...res, repoPath: path });
      } catch (err) {
        errors.push({ repoPath: path, message: err instanceof Error ? err.message : String(err) });
      }
    }
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
  return {
    ref: tree.ref,
    treeSha: tree.treeSha,
    truncated: tree.truncated,
    discovered,
    agents: rows.filter((r) => r.scorecard.kind === "subagent"),
    commands: rows.filter((r) => r.scorecard.kind === "command"),
    errors,
  };
}

const scanned = [];
let running = 0;
for (const repo of REPOS) {
  if (running >= maxTotal) {
    process.stderr.write(`(reached BEACON_MAX_TOTAL=${maxTotal} — skipping remaining repos)\n`);
    scanned.push({ repo, scan: null, failure: `not scanned — BEACON_MAX_TOTAL=${maxTotal} reached` });
    continue;
  }
  process.stderr.write(`scanning ${repo} …\n`);
  try {
    // Hard total cap: never let the final repo overshoot BEACON_MAX_TOTAL.
    const repoMax = Math.max(1, Math.min(maxPerRepo, maxTotal - running));
    const scan = await scanRepoAgentsCommands(repo, repoMax);
    scanned.push({ repo, scan, agents: scan.agents, commands: scan.commands });
    running += scan.agents.length + scan.commands.length;
    process.stderr.write(
      `  ${scan.agents.length} agents + ${scan.commands.length} commands graded ` +
        `(of ${scan.discovered.agents}+${scan.discovered.commands} discovered), ${scan.errors.length} errors ` +
        `(tree ${String(scan.treeSha).slice(0, 10)}) — running total ${running}\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`  x ${repo}: ${message}\n`);
    scanned.push({ repo, scan: null, failure: message });
  }
}

const agents = scanned.flatMap((s) => s.agents ?? []);
const commands = scanned.flatMap((s) => s.commands ?? []);
const total = agents.length + commands.length;
if (total === 0) {
  process.stderr.write("No agents or commands scanned — aborting.\n");
  process.exit(1);
}
const reposWithRows = scanned.filter((s) => (s.agents?.length ?? 0) + (s.commands?.length ?? 0) > 0).length;
const zeroYield = scanned.filter((s) => s.scan && (s.agents?.length ?? 0) + (s.commands?.length ?? 0) === 0);
const failed = scanned.filter((s) => !s.scan);

/** Grade buckets + average + per-check pass/warn/fail over one kind's rows. */
function stats(rows, checkIds) {
  const buckets = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const r of rows) buckets[r.scorecard.grade[0]] = (buckets[r.scorecard.grade[0]] ?? 0) + 1;
  const avg = rows.length === 0 ? 0 : rows.reduce((a, r) => a + r.scorecard.overall, 0) / rows.length;
  const checks = {};
  for (const id of checkIds) checks[id] = { pass: 0, warn: 0, fail: 0, ran: 0 };
  for (const row of rows) {
    for (const res of row.scorecard.results) {
      if (checks[res.id]) {
        checks[res.id][res.status]++;
        checks[res.id].ran++;
      }
    }
  }
  return { buckets, avg, checks };
}
const A = stats(agents, AGENT_CHECK_IDS);
const C = stats(commands, COMMAND_CHECK_IDS);

// SAFETY-02 split on agents: the "no `tools` list → inherits EVERY tool" trap vs unrestricted
// Bash vs wildcard grants. The trap is identified by the check's own evidence wording.
let noToolsTrap = 0;
let bashWarn = 0;
let wildcardFail = 0;
for (const row of agents) {
  const r = row.scorecard.results.find((x) => x.id === "SAFETY-02");
  if (!r || r.status === "pass") continue;
  const inherits = (r.evidence ?? []).some((e) => String(e.verified ?? "").includes("inherits every tool"));
  if (r.status === "warn" && inherits) noToolsTrap++;
  else if (r.status === "warn") bashWarn++;
  else if (r.status === "fail") wildcardFail++;
}

const pctOf = (n, d) => (d === 0 ? "0%" : `${((n / d) * 100).toFixed(0)}%`);
const bar = (n, d, width = 20) => {
  const filled = d === 0 ? 0 : Math.round((n / d) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
};

/** Worst (most warn+fail) checks for a kind, excluding the informational TOKEN-04. */
function worstChecks(checkStats) {
  return Object.entries(checkStats)
    .filter(([id, c]) => c.ran > 0 && id !== "TOKEN-04")
    .map(([id, c]) => ({ id, notPassing: c.warn + c.fail, ran: c.ran, share: (c.warn + c.fail) / c.ran }))
    .sort((a, b) => b.share - a.share);
}
const worstAgent = worstChecks(A.checks);
const worstCommand = worstChecks(C.checks);

// Local date (not UTC) — the run's calendar date where it was executed.
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const lines = [];
lines.push("# The State of Claude Code Agents & Commands");
lines.push("");
lines.push(
  `*An evidence-based audit of ${total} public Claude Code artifacts — ${agents.length} subagents and ${commands.length} slash commands across ${reposWithRows} repositories — graded by **Skill Crossroads** (rubric v1.2), the signpost for Claude Code artifacts. Every figure below comes from this run and is traceable to the pinned git trees in the methodology. Generated ${today}.*`,
);
lines.push("");
lines.push(
  "> **Edition disclosure — deterministic only.** No LLM-assisted checks ran in this edition. Every figure is from Skill Crossroads' pure, bit-reproducible deterministic checks. The triggering figures come from the deterministic description-quality checks (TRIGGER-02 description length, TRIGGER-03 invocation cues, TRIGGER-05 invocation-flag consistency) — **not** the LLM triggering judge (TRIGGER-01), which was excluded for cost and reproducibility.",
);
lines.push("");
lines.push(
  `> **Scope.** A curated sample of community subagent and command collections (up to ${maxPerRepo} artifacts each, ${maxTotal} total). Only \`subagent\` and \`command\` artifacts are graded — skills, MCP configs, and plugin manifests in the same repos are out of scope for this report. Repos whose layout Skill Crossroads cannot discover (agents at the repo root or in category directories instead of an \`agents/\` or \`commands/\` parent dir) are disclosed in the methodology table rather than silently dropped.`,
);
lines.push("");

// ── Headline: derived from this run's numbers, never pre-written. ──
lines.push("## The headline");
lines.push("");
const wa = worstAgent[0];
const wc = worstCommand[0];
if (agents.length > 0) {
  lines.push(
    `Across ${agents.length} subagents, the average Skill Crossroads score is **${A.avg.toFixed(1)}/100**. The single most common subagent problem in this run is **${CHECK_LABELS[wa.id]}** (${wa.id}): **${pctOf(wa.notPassing, wa.ran)}** don't cleanly pass it (${wa.notPassing} of ${wa.ran}).`,
  );
  lines.push("");
}
if (commands.length > 0) {
  lines.push(
    `Across ${commands.length} slash commands, the average score is **${C.avg.toFixed(1)}/100**. The most common command problem is **${CHECK_LABELS[wc.id]}** (${wc.id}): **${pctOf(wc.notPassing, wc.ran)}** don't cleanly pass it (${wc.notPassing} of ${wc.ran}).`,
  );
  lines.push("");
}
const s2 = A.checks["SAFETY-02"];
if (agents.length > 0 && s2 && s2.ran > 0) {
  const extras = [
    bashWarn > 0 ? `${bashWarn} more granting bare \`Bash\`` : "",
    wildcardFail > 0 ? `${wildcardFail} granting a wildcard` : "",
  ].filter(Boolean);
  lines.push(
    `**${pctOf(noToolsTrap, s2.ran)} of subagents (${noToolsTrap} of ${s2.ran}) declare no \`tools\` list at all** — which means each one silently inherits *every* tool, including unrestricted Bash.${
      extras.length > 0 ? ` Add ${extras.join(" and ")}, and` : " In total,"
    } **${pctOf(s2.warn + s2.fail, s2.ran)}** of the subagent sample is not least-privilege (SAFETY-02).`,
  );
  lines.push("");
}

lines.push("## Grade distribution");
lines.push("");
lines.push("| Grade | Subagents | Share | Commands | Share |");
lines.push("|---|---|---|---|---|");
for (const g of ["A", "B", "C", "D", "F"]) {
  lines.push(
    `| ${g} | ${A.buckets[g] ?? 0} | ${pctOf(A.buckets[g] ?? 0, agents.length)} | ${C.buckets[g] ?? 0} | ${pctOf(C.buckets[g] ?? 0, commands.length)} |`,
  );
}
lines.push("");
lines.push(
  `Average overall: **subagents ${A.avg.toFixed(1)}/100**, **commands ${C.avg.toFixed(1)}/100**. Deterministic grades are computed over the evaluated categories with weights renormalized — LLM-only categories (e.g. Verifiability for agents/commands) stay honestly unscored in this edition.`,
);
lines.push("");

function chartBlock(title, rowCount, checkStats, order) {
  lines.push(`## ${title}`);
  lines.push("");
  lines.push(`Share of the ${rowCount} that **pass cleanly** (higher is better):`);
  lines.push("");
  lines.push("```");
  for (const id of order) {
    const c = checkStats[id];
    if (!c || c.ran === 0) continue;
    const label = `${id} ${CHECK_LABELS[id]}`.padEnd(45);
    lines.push(`${label} ${bar(c.pass, c.ran)} ${pctOf(c.pass, c.ran).padStart(4)}   n=${c.ran} (${c.warn} warn, ${c.fail} fail)`);
  }
  lines.push("```");
  lines.push("");
}
if (agents.length > 0) chartBlock(`How ${agents.length} subagents do on each check`, `${agents.length} subagents`, A.checks, AGENT_CHECK_IDS);
if (commands.length > 0) chartBlock(`How ${commands.length} slash commands do on each check`, `${commands.length} commands`, C.checks, COMMAND_CHECK_IDS);

// ── Named findings the run actually measured (rates interpolated, selection data-driven). ──
lines.push("## Findings");
lines.push("");
const findings = [];
if (agents.length > 0 && s2 && s2.ran > 0) {
  findings.push(
    `**The no-\`tools\` inherits-everything trap (SAFETY-02).** ${noToolsTrap} of ${s2.ran} subagents (${pctOf(noToolsTrap, s2.ran)}) omit the \`tools\` field. That reads like a safe default but is the opposite: a subagent without a \`tools\` list inherits the caller's entire toolbox — Bash included — so a delegated worker meant to "just read code" can run arbitrary shell commands.${[
      bashWarn > 0 ? ` ${bashWarn} more grant bare \`Bash\` outright` : "",
      wildcardFail > 0 ? `${bashWarn > 0 ? " and" : ""} ${wildcardFail} grant a wildcard` : "",
    ].join("")}${bashWarn > 0 || wildcardFail > 0 ? "." : ""}`,
  );
}
const a1 = A.checks["AGENT-01"];
if (agents.length > 0 && a1 && a1.ran > 0) {
  findings.push(
    a1.fail > 0
      ? `**Model typos that fail silently at runtime (AGENT-01).** ${a1.fail} of ${a1.ran} subagents (${pctOf(a1.fail, a1.ran)}) declare a \`model:\` value that is not a recognized alias (\`sonnet\`/\`opus\`/\`haiku\`/\`inherit\`) or \`claude-*\` id — every delegation to those agents fails at runtime, far from the typo that caused it.`
      : `**Model declarations are clean (AGENT-01).** 0 of ${a1.ran} subagents have a typo'd \`model:\` value — every declared model is a recognized alias (\`sonnet\`/\`opus\`/\`haiku\`/\`inherit\`) or \`claude-*\` id. The runtime-failure trap this check exists for did not appear in this sample.`,
  );
}
const t2 = A.checks["TRIGGER-02"];
const t3 = A.checks["TRIGGER-03"];
if (agents.length > 0 && t2 && t2.ran > 0 && t3) {
  findings.push(
    `**Descriptions too thin to trigger delegation (TRIGGER-02/03).** ${pctOf(t2.warn + t2.fail, t2.ran)} of subagent descriptions (${t2.warn + t2.fail} of ${t2.ran}) are too short to anchor automatic delegation, and ${pctOf(t3.warn + t3.fail, t3.ran)} (${t3.warn + t3.fail} of ${t3.ran}) lack the invocation cues ("use when…", "use PROACTIVELY…") Claude matches on. An agent whose description doesn't say when to use it is an agent that never fires. (Deterministic proxies — the LLM triggering judge did not run in this edition.)`,
  );
}
const c1 = C.checks["CMD-01"];
if (commands.length > 0 && c1 && c1.ran > 0) {
  findings.push(
    `**\`$ARGUMENTS\` vs \`argument-hint\` drift (CMD-01).** ${c1.warn + c1.fail} of ${c1.ran} commands (${pctOf(c1.warn + c1.fail, c1.ran)}) use arguments without declaring \`argument-hint\` (or declare a hint they never use) — the user gets no signature hint at the prompt, or a misleading one.`,
  );
}
const s1a = A.checks["SAFETY-01"];
const s1c = C.checks["SAFETY-01"];
const secretFails = (s1a?.fail ?? 0) + (s1c?.fail ?? 0);
findings.push(
  `**Hardcoded secrets (SAFETY-01).** ${secretFails} of ${total} artifacts (${pctOf(secretFails, total)}) tripped the secret scan${secretFails === 0 ? " — the one check this sample passes across the board" : ""}.`,
);
for (const f of findings) {
  lines.push(`- ${f}`);
}
lines.push("");

const cleanRows = (rows) => rows.filter((r) => r.scorecard.results.every((x) => x.status === "pass")).length;
const cleanA = cleanRows(agents);
const cleanC = cleanRows(commands);
lines.push("## What this means");
lines.push("");
lines.push(
  `**${cleanA} of ${agents.length} subagents (${pctOf(cleanA, agents.length)})** and **${cleanC} of ${commands.length} commands (${pctOf(cleanC, commands.length)})** pass every deterministic check cleanly.`,
);
lines.push("");
const offenders = [
  ...worstAgent.filter((w) => w.notPassing > 0).slice(0, 5).map((w) => `- subagents — ${CHECK_LABELS[w.id]} (${w.id}): ${w.notPassing} of ${w.ran}`),
  ...worstCommand.filter((w) => w.notPassing > 0).slice(0, 5).map((w) => `- commands — ${CHECK_LABELS[w.id]} (${w.id}): ${w.notPassing} of ${w.ran}`),
];
if (offenders.length > 0) {
  lines.push("The most common defects across the sample:");
  lines.push("");
  lines.push(...offenders);
  lines.push("");
  lines.push(
    "Each is catchable **before** publishing, with `npx skillcrossroads ./your-repo` — the same engine grades agents, commands, skills, MCP configs, and plugins.",
  );
}
lines.push("");

lines.push("## Methodology & reproducibility");
lines.push("");
lines.push(
  `Skill Crossroads' **deterministic checks only** (rubric v1.2, no LLM) were run ${today} against each repo's git tree at the sha below — the engine's own discovery (\`findArtifactFiles\`) and grading (\`auditAsync\`) pipeline, identical to what the hosted scanner runs on these kinds. Deterministic checks are pure, so re-scanning the same tree reproduces these figures exactly. The LLM-assisted checks (TRIGGER-01 triggering judge, VERIFY-04, CLARITY-05, CLARITY-02) were excluded from this edition for cost and reproducibility — triggering figures above are the deterministic TRIGGER-02/03/05 proxies.`,
);
lines.push("");
lines.push(
  `Caps: up to ${maxPerRepo} artifacts per repo (\`BEACON_MAX_PER_REPO\`), ${maxTotal} total (\`BEACON_MAX_TOTAL\`). Discovery finds \`.md\` files whose parent directory is \`agents/\` or \`commands/\` at any depth; each kind is sampled alphabetically, and when a repo ships both kinds the per-repo cap is split between them so neither crowds the other out of the sample. "Discovered" below is everything in the tree matching that layout; "graded" is the capped sample this report aggregates. A repo where discovery finds nothing is marked "no discoverable agent/command layout".`,
);
lines.push("");
lines.push("| Repo | Ref | Tree sha | Agents graded | Commands graded | Discovered (agents+cmds) | Errors | Note |");
lines.push("|---|---|---|---|---|---|---|---|");
for (const s of scanned) {
  if (!s.scan) {
    lines.push(`| ${s.repo} | — | — | 0 | 0 | — | — | ${s.failure} |`);
    continue;
  }
  const discovered = s.scan.discovered.agents + s.scan.discovered.commands;
  const note =
    (discovered === 0 ? "no discoverable agent/command layout" : "") +
    (s.scan.truncated ? (discovered === 0 ? "; tree truncated" : "tree truncated (very large repo)") : "");
  lines.push(
    `| ${s.repo} | ${s.scan.ref} | \`${String(s.scan.treeSha).slice(0, 12)}\` | ${s.agents.length} | ${s.commands.length} | ${s.scan.discovered.agents}+${s.scan.discovered.commands} | ${s.scan.errors.length} | ${note} |`,
  );
}
lines.push("");
lines.push(
  "Reproduce: `npm run build && node scripts/state-of-agents.mjs` (default repo set; set `GITHUB_TOKEN` for rate limits) — or pass `owner/repo …` to scan your own.",
);
lines.push("");

const outDir = join(here, "..", "reports");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "state-of-claude-code-agents.md");
writeFileSync(outPath, lines.join("\n"), "utf8");
process.stderr.write(
  `\nWrote ${outPath} (${agents.length} agents + ${commands.length} commands across ${reposWithRows} repo(s) with rows; ${zeroYield.length} zero-yield, ${failed.length} failed)\n`,
);
