/**
 * @beacon/core — the Beacon rule engine.
 *
 * Pure pipeline:  parse ▸ runChecks ▸ score ▸ render.
 * Model-agnostic and deterministic in v0.1 (no network, no LLM).
 */
export * from "./types.js";
export { parse, splitFrontmatter, ParseError } from "./parse.js";
export { runChecks, CHECKS } from "./checks/index.js";
export { score, letterGrade } from "./score.js";
export { renderTerminal, type RenderOptions } from "./render/terminal.js";
export { renderHtml, type HtmlOptions } from "./render/html.js";
export { renderBadge, type BadgeOptions } from "./render/badge.js";
export { PALETTE, gradeHex } from "./render/theme.js";

import { basename } from "node:path";
import { parse } from "./parse.js";
import { runChecks } from "./checks/index.js";
import { score } from "./score.js";
import type { ArtifactType, Scorecard, Artifact } from "./types.js";

export interface AuditResult {
  readonly artifact: Artifact;
  readonly scorecard: Scorecard;
  /** A short display name derived from frontmatter `name` or the directory. */
  readonly name: string;
}

/** Convenience: parse a skill directory and return its full scorecard. */
export function audit(inputPath: string, type: ArtifactType = "skill"): AuditResult {
  const artifact = parse(inputPath, type);
  const scorecard = score(runChecks(artifact));
  const fmName = artifact.frontmatter?.["name"];
  const name = typeof fmName === "string" && fmName.trim() ? fmName.trim() : basename(artifact.root);
  return { artifact, scorecard, name };
}
