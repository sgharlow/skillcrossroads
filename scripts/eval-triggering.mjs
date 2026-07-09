#!/usr/bin/env node
/**
 * TRIGGER-01 eval harness (Build Bible Sprint 3 acceptance: verdicts match hand-labels >=80%).
 *
 * Runs the LLM-assisted triggering check against a hand-labeled dataset and reports agreement.
 * BYOK: requires ANTHROPIC_API_KEY. Without it, prints instructions and exits 0 (skipped) — so
 * the check stays honest about being "wired, not live-proven" until a real run happens.
 *
 *   npm run build && ANTHROPIC_API_KEY=sk-... node scripts/eval-triggering.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { trigger01, createAnthropicClient, createFileCache } from "../packages/core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = join(here, "..", "packages", "core", "test", "fixtures", "triggering-eval.json");
const { cases } = JSON.parse(readFileSync(dataPath, "utf8"));

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.log("ANTHROPIC_API_KEY not set — skipping live eval (TRIGGER-01 remains wired, not live-proven).");
  console.log(`Dataset has ${cases.length} hand-labeled cases; set the key and re-run to measure agreement.`);
  process.exit(0);
}

const model = createAnthropicClient({ apiKey, model: process.env.BEACON_MODEL });
const cache = createFileCache(join(here, "..", ".beacon-cache"));

function artifactFor(c) {
  return {
    type: "skill",
    root: `/eval/${c.name}`,
    entryPath: `/eval/${c.name}/SKILL.md`,
    raw: "",
    frontmatter: { name: c.name, description: c.description },
    frontmatterError: null,
    body: c.body ?? "",
    bodyStartLine: 1,
    files: [],
  };
}

// pass => predicted "good"; warn/fail => predicted "bad".
const predicted = (status) => (status === "pass" ? "good" : "bad");

let agree = 0;
const rows = [];
for (const c of cases) {
  const result = await trigger01.run(artifactFor(c), { model, cache });
  const pred = predicted(result.status);
  const ok = pred === c.label;
  if (ok) agree++;
  rows.push({ name: c.name, label: c.label, score: result.score, pred, ok });
}

for (const r of rows) {
  const mark = r.ok ? "✓" : "✗";
  console.log(`${mark} ${r.name.padEnd(20)} label=${r.label.padEnd(4)} score=${String(r.score).padStart(3)} pred=${r.pred}`);
}

const pct = (agree / cases.length) * 100;
const GATE = 80;
console.log(`\nAgreement: ${agree}/${cases.length} = ${pct.toFixed(1)}%  (gate: >=${GATE}%)`);
if (pct >= GATE) {
  console.log("PASS — TRIGGER-01 meets the Sprint 3 acceptance gate.");
  process.exit(0);
} else {
  console.log("FAIL — below gate. Tune the rubric/prompt in trigger-01-triggering.ts and re-run.");
  process.exit(1);
}
