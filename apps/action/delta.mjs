#!/usr/bin/env node
/**
 * Print a markdown "Changes vs base" section from two `--json=<file>` outputs:
 *   node delta.mjs <base.json> <head.json>
 * Best-effort by design: any missing/unreadable input prints nothing and exits 0 — a broken
 * base scan must never break the PR report. No dependencies.
 */
import { readFileSync } from "node:fs";

function load(path) {
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(j.skills) ? j.skills : null;
  } catch {
    return null;
  }
}

const [, , basePath, headPath] = process.argv;
const base = basePath ? load(basePath) : null;
const head = headPath ? load(headPath) : null;
if (!base || !head) process.exit(0);

const baseBy = new Map(base.map((s) => [s.repoPath, s]));
const lines = [];

for (const h of head) {
  const b = baseBy.get(h.repoPath);
  if (!b) {
    lines.push(`- 🆕 \`${h.repoPath}\` — new: **${h.grade}** (${h.overall}/100)`);
    continue;
  }
  baseBy.delete(h.repoPath);
  if (b.grade !== h.grade || b.overall !== h.overall) {
    const d = Math.round((h.overall - b.overall) * 10) / 10;
    const arrow = d > 0 ? "📈" : d < 0 ? "📉" : "↔";
    lines.push(`- ${arrow} \`${h.repoPath}\` — **${b.grade} → ${h.grade}** (${d > 0 ? "+" : ""}${d})`);
  }
}
for (const [repoPath, b] of baseBy) {
  lines.push(`- 🗑 \`${repoPath}\` — removed (was ${b.grade})`);
}

if (lines.length === 0) process.exit(0);

const avg = (arr) => (arr.length ? arr.reduce((a, s) => a + s.overall, 0) / arr.length : 0);
const dAvg = Math.round((avg(head) - avg(base)) * 10) / 10;
process.stdout.write(
  `\n**Changes vs base** (average ${dAvg >= 0 ? "+" : ""}${dAvg})\n\n${lines.join("\n")}\n`,
);
