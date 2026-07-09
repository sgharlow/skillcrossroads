/**
 * @beacon/core — the Beacon rule engine.
 *
 * Pure pipeline:  parse ▸ runChecks ▸ score ▸ render.
 * Model-agnostic and deterministic in v0.1 (no network, no LLM).
 */
export * from "./types.js";
export { parse, splitFrontmatter, ParseError } from "./parse.js";
export { runChecks, runChecksAsync, CHECKS, ASYNC_CHECKS, trigger01 } from "./checks/index.js";
export { parseVerdict, mapVerdict, type TriggerVerdict } from "./checks/trigger-01-triggering.js";
export type { AsyncCheck, CheckContext } from "./checks/async.js";
export { score, letterGrade } from "./score.js";
export type { ModelClient, StructuredRequest, JsonSchema } from "./llm/types.js";
export { createAnthropicClient, DEFAULT_MODEL, ModelError } from "./llm/anthropic.js";
export { createFileCache, createMemoryCache, hashKey, type Cache } from "./llm/cache.js";
export { renderTerminal, type RenderOptions } from "./render/terminal.js";
export { renderHtml, type HtmlOptions } from "./render/html.js";
export { renderBadge, type BadgeOptions } from "./render/badge.js";
export { PALETTE, gradeHex } from "./render/theme.js";

import { basename } from "node:path";
import { parse } from "./parse.js";
import { runChecks, runChecksAsync } from "./checks/index.js";
import type { CheckContext } from "./checks/async.js";
import { score } from "./score.js";
import type { ArtifactType, Scorecard, Artifact } from "./types.js";

export interface AuditResult {
  readonly artifact: Artifact;
  readonly scorecard: Scorecard;
  /** A short display name derived from frontmatter `name` or the directory. */
  readonly name: string;
}

function displayName(artifact: Artifact): string {
  const fmName = artifact.frontmatter?.["name"];
  return typeof fmName === "string" && fmName.trim() ? fmName.trim() : basename(artifact.root);
}

/** Convenience: parse a skill directory and return its deterministic scorecard (no LLM). */
export function audit(inputPath: string, type: ArtifactType = "skill"): AuditResult {
  const artifact = parse(inputPath, type);
  const scorecard = score(runChecks(artifact));
  return { artifact, scorecard, name: displayName(artifact) };
}

/**
 * Parse and grade a skill, running LLM-assisted checks too when `ctx.model` is supplied.
 * With no model it is equivalent to `audit()` — deterministic only.
 */
export async function auditAsync(
  inputPath: string,
  ctx: CheckContext = {},
  type: ArtifactType = "skill",
): Promise<AuditResult> {
  const artifact = parse(inputPath, type);
  const scorecard = score(await runChecksAsync(artifact, ctx));
  return { artifact, scorecard, name: displayName(artifact) };
}
