#!/usr/bin/env node
/**
 * Post (or update) a single Skill Crossroads scorecard comment on a pull request.
 * Uses the GitHub REST API via fetch — no dependencies. Finds a prior Skill Crossroads comment by a hidden
 * marker and edits it in place, so re-runs don't spam the PR.
 *
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), PR_NUMBER, REPORT_FILE.
 */
import { readFileSync } from "node:fs";

const MARKER = "<!-- crossroads-scorecard -->";
const API = process.env.GITHUB_API_URL || "https://api.github.com";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const pr = process.env.PR_NUMBER;
const reportFile = process.env.REPORT_FILE;

if (!token || !repo || !pr || !reportFile) {
  console.log("Skill Crossroads comment: missing GITHUB_TOKEN / GITHUB_REPOSITORY / PR_NUMBER / REPORT_FILE — skipping.");
  process.exit(0);
}

let report = "";
try {
  report = readFileSync(reportFile, "utf8").trim();
} catch {
  report = "";
}
if (!report) {
  console.log("Skill Crossroads comment: empty report — skipping.");
  process.exit(0);
}

const headers = {
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "content-type": "application/json",
  "user-agent": "crossroads-action",
};
const body = `${MARKER}\n${report}\n\n<sub>Graded by Skill Crossroads — the signpost for Claude Code skills, agents, and MCP servers.</sub>`;

async function gh(method, path, payload) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Find an existing Skill Crossroads comment id (by marker) across the PR's comments. */
async function findExisting() {
  let page = 1;
  for (;;) {
    const comments = await gh("GET", `/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`);
    const hit = comments.find((c) => typeof c.body === "string" && c.body.includes(MARKER));
    if (hit) return hit.id;
    if (comments.length < 100) return undefined;
    page++;
  }
}

try {
  const existing = await findExisting();
  if (existing) {
    await gh("PATCH", `/repos/${repo}/issues/comments/${existing}`, { body });
    console.log(`Skill Crossroads comment: updated #${existing}.`);
  } else {
    const created = await gh("POST", `/repos/${repo}/issues/${pr}/comments`, { body });
    console.log(`Skill Crossroads comment: created #${created.id}.`);
  }
} catch (err) {
  // Never fail the build just because commenting failed (e.g. fork PR with a read-only token).
  console.log(`Skill Crossroads comment: ${err instanceof Error ? err.message : String(err)} — continuing.`);
}
