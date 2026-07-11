#!/usr/bin/env node
/**
 * Regenerate the ecosystem-percentile SAMPLE (packages/core/src/percentile.ts STATE_OF_SKILLS)
 * under the CURRENT rubric, deterministic edition.
 *
 * Why this exists: the percentile compares a live keyless scan against a stored grade
 * distribution. Those two numbers are only comparable when they come from the SAME rubric and
 * edition — a rubric bump that adds checks shifts live scores relative to a stale sample and
 * silently inflates (or deflates) the percentile. Run this after EVERY rubric bump and paste
 * the emitted block into percentile.ts. The published State-of-Skills REPORT is a separate,
 * pinned artifact (LLM edition, its own rubric stamp) — this script never touches it.
 *
 *   npm run build && GITHUB_TOKEN=$(gh auth token) node scripts/percentile-sample.mjs
 *
 * Env: GITHUB_TOKEN (rate limits), BEACON_MAX_PER_REPO (default 12), BEACON_MAX_TOTAL (260).
 */
import { scanGitHubRepo, RUBRIC_VERSION } from "../packages/core/dist/index.js";

/** Same curated sample as scripts/state-of-skills.mjs — keep the two lists in sync. */
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

const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
let total = 0;
const failures = [];

for (const repo of REPOS) {
  if (total >= maxTotal) break;
  process.stderr.write(`scanning ${repo}…\n`);
  try {
    const res = await scanGitHubRepo(repo, {}, { token, max: Math.min(maxPerRepo, maxTotal - total) });
    // Skills only — the percentile compares SKILL cards (renderers gate on kind === "skill").
    for (const s of res.skills) {
      if ((s.scorecard.kind ?? "skill") !== "skill") continue;
      const bucket = s.scorecard.grade[0];
      if (bucket in grades) grades[bucket] += 1;
      total += 1;
    }
  } catch (err) {
    failures.push(`${repo}: ${err instanceof Error ? err.message : err}`);
    process.stderr.write(`  FAILED: ${err}\n`);
  }
}

process.stderr.write(`\nfailures: ${failures.length}\n${failures.join("\n")}\n`);
// Emit the exact PercentileSample block for packages/core/src/percentile.ts.
process.stdout.write(
  [
    `// Deterministic rubric v${RUBRIC_VERSION} sample — generated ${new Date().toISOString().slice(0, 10)}`,
    `// by scripts/percentile-sample.mjs over ${REPOS.length} repos (${failures.length} failed).`,
    `{`,
    `  edition: "${new Date().toISOString().slice(0, 7)} · deterministic rubric v${RUBRIC_VERSION}",`,
    `  n: ${total},`,
    `  buckets: [`,
    `    { min: 0, max: 60, count: ${grades.F} }, // F`,
    `    { min: 60, max: 70, count: ${grades.D} }, // D`,
    `    { min: 70, max: 80, count: ${grades.C} }, // C`,
    `    { min: 80, max: 90, count: ${grades.B} }, // B`,
    `    { min: 90, max: 100, count: ${grades.A} }, // A`,
    `  ],`,
    `}`,
    "",
  ].join("\n"),
);
