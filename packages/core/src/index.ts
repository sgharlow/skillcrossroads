/**
 * @beacon/core — the Beacon rule engine.
 *
 * Pure pipeline:  parse ▸ runChecks ▸ score ▸ render.
 * Model-agnostic and deterministic in v0.1 (no network, no LLM).
 */
export * from "./types.js";
export { parse, splitFrontmatter, detectKind, ParseError } from "./parse.js";
export { runChecks, runChecksAsync, CHECKS, ASYNC_CHECKS, trigger01, verify04, clarity05 } from "./checks/index.js";
export { parseVerdict, mapVerdict, type TriggerVerdict } from "./checks/trigger-01-triggering.js";
export { parseVerify, mapVerify, type VerifyVerdict } from "./checks/verify-04-verification.js";
export { parseConstraints, mapConstraints, type ConstraintVerdict } from "./checks/clarity-05-constraints.js";
export type { AsyncCheck, CheckContext } from "./checks/async.js";
export { score, letterGrade, gradeRank, meetsMinGrade, GRADE_ORDER } from "./score.js";
export { renderMarkdown, mdCell, type MarkdownOptions } from "./render/markdown.js";
export type { ModelClient, StructuredRequest, JsonSchema } from "./llm/types.js";
export { createAnthropicClient, DEFAULT_MODEL, ModelError } from "./llm/anthropic.js";
export { createFileCache, createMemoryCache, hashKey, type Cache } from "./llm/cache.js";
export {
  estimateTokens,
  heuristicCounter,
  createAnthropicTokenCounter,
  CHARS_PER_TOKEN,
  type TokenCounter,
} from "./llm/tokens.js";
export * from "./github.js";
export { renderTerminal, type RenderOptions } from "./render/terminal.js";
export { renderHtml, type HtmlOptions } from "./render/html.js";
export { renderBadge, type BadgeOptions } from "./render/badge.js";
export { PALETTE, gradeHex } from "./render/theme.js";
export { renderAnnotations, type AnnotatableResult } from "./render/annotations.js";
export {
  introspectMcpConfig,
  gradeMcpLive,
  type McpTool,
  type McpServerIntrospection,
} from "./mcp-live.js";
export { publicSkillPercentile, percentileLabel, STATE_OF_SKILLS, type PercentileSample } from "./percentile.js";
export {
  loadConfig,
  parseConfig,
  applySuppressions,
  ConfigError,
  CONFIG_FILENAME,
  type CrossroadsConfig,
} from "./suppress.js";

import { basename, join, resolve, relative, sep } from "node:path";
import { mkdtempSync, rmSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { parse } from "./parse.js";
import { runChecks, runChecksAsync } from "./checks/index.js";
import type { CheckContext } from "./checks/async.js";
import { score } from "./score.js";
import type { ArtifactType, Scorecard, Artifact } from "./types.js";
import {
  parseGitHubUrl,
  fetchRepoTree,
  findSkillDirs,
  findArtifactFiles,
  materializeSkill,
  fetchArtifactFile,
  type GitHubFetchOptions,
} from "./github.js";

export interface AuditResult {
  readonly artifact: Artifact;
  readonly scorecard: Scorecard;
  /** A short display name derived from frontmatter `name` or the directory. */
  readonly name: string;
}

function displayName(artifact: Artifact): string {
  const fmName = artifact.frontmatter?.["name"];
  if (typeof fmName === "string" && fmName.trim()) return fmName.trim();
  // Single-file artifacts are named by their filename; skills by their directory.
  if (artifact.type === "subagent" || artifact.type === "command") {
    return basename(artifact.entryPath).replace(/\.md$/i, "");
  }
  if (artifact.type === "mcp") return basename(artifact.entryPath);
  return basename(artifact.root);
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
  extra: { unscannedFiles?: readonly string[] } = {},
): Promise<AuditResult> {
  const base = parse(inputPath, type);
  const artifact: Artifact =
    extra.unscannedFiles && extra.unscannedFiles.length > 0
      ? { ...base, unscannedFiles: extra.unscannedFiles }
      : base;
  const scorecard = score(await runChecksAsync(artifact, ctx));
  return { artifact, scorecard, name: displayName(artifact) };
}

/** One graded skill from a repo scan, tagged with its path inside the repo. */
export interface ScannedSkill extends AuditResult {
  readonly repoPath: string;
}

const IGNORED_WALK = new Set([".git", "node_modules", "dist", ".next", ".beacon-cache"]);

/** Find every skill directory (containing SKILL.md) under a local path. Does not descend into one. */
export function findLocalSkillDirs(root: string): string[] {
  const abs = resolve(root);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    if (entries.some((e) => e.toLowerCase() === "skill.md")) {
      out.push(dir);
      return; // a skill dir — don't descend further
    }
    for (const name of entries) {
      if (IGNORED_WALK.has(name)) continue;
      const full = join(dir, name);
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch {
        /* unreadable entry — skip */
      }
    }
  };
  walk(abs);
  return out.sort();
}

/**
 * Find subagent and slash-command files under a local path: any `.md` directly inside a
 * directory named `agents/` or `commands/` (covers `.claude/agents`, plugin layouts, and bare
 * `agents/` folders). README files are skipped — they document, they don't run.
 */
export function findLocalAgentCommandFiles(root: string): { agents: string[]; commands: string[] } {
  const abs = resolve(root);
  const agents: string[] = [];
  const commands: string[] = [];
  if (!existsSync(abs)) return { agents, commands };
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    const dirName = basename(dir).toLowerCase();
    for (const name of entries) {
      if (IGNORED_WALK.has(name)) continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full);
        } else if (
          /\.md$/i.test(name) &&
          !/^readme\.md$/i.test(name) &&
          (dirName === "agents" || dirName === "commands")
        ) {
          (dirName === "agents" ? agents : commands).push(full);
        }
      } catch {
        /* unreadable entry — skip */
      }
    }
  };
  walk(abs);
  return { agents: agents.sort(), commands: commands.sort() };
}

export interface LocalScanResult {
  readonly skills: readonly ScannedSkill[];
  readonly errors: ReadonlyArray<{ repoPath: string; message: string }>;
}

/** Scan every skill, subagent, and slash command under a local directory (CI checkout, a repo). */
export async function scanLocalDir(root: string, ctx: CheckContext = {}): Promise<LocalScanResult> {
  const abs = resolve(root);
  const dirs = findLocalSkillDirs(abs);
  const { agents, commands } = findLocalAgentCommandFiles(abs);
  const skills: ScannedSkill[] = [];
  const errors: Array<{ repoPath: string; message: string }> = [];
  const scanOne = async (path: string, type: ArtifactType): Promise<void> => {
    const repoPath = relative(abs, path).split(sep).join("/") || basename(path);
    try {
      const res = await auditAsync(path, ctx, type);
      skills.push({ ...res, repoPath });
    } catch (err) {
      errors.push({ repoPath, message: err instanceof Error ? err.message : String(err) });
    }
  };
  for (const dir of dirs) await scanOne(dir, "skill");
  for (const f of agents) await scanOne(f, "subagent");
  for (const f of commands) await scanOne(f, "command");
  // MCP Phase A: a project-level .mcp.json at the scan root.
  const mcpConfig = join(abs, ".mcp.json");
  if (existsSync(mcpConfig)) await scanOne(mcpConfig, "mcp");
  return { skills, errors };
}

export interface RepoScanResult {
  /** The ref (branch/tag/sha) actually scanned. */
  readonly ref: string;
  /** Git tree sha — pins the exact content, so a report's figures are reproducible. */
  readonly treeSha: string;
  /** True if GitHub truncated the tree (very large repo). */
  readonly truncated: boolean;
  readonly skills: readonly ScannedSkill[];
  /** Skills that could not be scanned (e.g. rate-limited), so a batch still returns partial results. */
  readonly errors: ReadonlyArray<{ repoPath: string; message: string }>;
}

/**
 * Scan every skill in a public GitHub repo by URL — no local clone for the user. Fetches each
 * skill's files into a temp directory, grades them via the normal pipeline, then cleans up.
 */
export async function scanGitHubRepo(
  url: string,
  ctx: CheckContext = {},
  opts: GitHubFetchOptions & { max?: number; subpath?: string } = {},
): Promise<RepoScanResult> {
  const target = parseGitHubUrl(url);
  const tree = await fetchRepoTree(target, opts);
  const subpath = opts.subpath ?? target.subpath;
  const dirs = findSkillDirs(tree.entries, subpath);
  const files = findArtifactFiles(tree.entries, subpath);
  const limited = opts.max ? dirs.slice(0, opts.max) : dirs;

  const dest = mkdtempSync(join(tmpdir(), "beacon-gh-"));
  const skills: ScannedSkill[] = [];
  const errors: Array<{ repoPath: string; message: string }> = [];
  try {
    for (const dir of limited) {
      const repoPath = dir || "(root)";
      try {
        const unscanned: string[] = [];
        const local = await materializeSkill(target, dir, tree, dest, {
          ...opts,
          onPlaceholder: (rel) => unscanned.push(rel),
        });
        const res = await auditAsync(local, ctx, "skill", { unscannedFiles: unscanned });
        skills.push({ ...res, repoPath });
      } catch (err) {
        errors.push({ repoPath, message: err instanceof Error ? err.message : String(err) });
      }
    }
    // Single-file artifacts (subagents, commands, .mcp.json): one raw fetch each, graded through
    // the same pipeline. The `max` cap applies across everything scanned, skills first.
    const singles: Array<{ path: string; kind: ArtifactType }> = [
      ...files.agents.map((p) => ({ path: p, kind: "subagent" as ArtifactType })),
      ...files.commands.map((p) => ({ path: p, kind: "command" as ArtifactType })),
      ...files.mcp.map((p) => ({ path: p, kind: "mcp" as ArtifactType })),
    ];
    const budget = opts.max ? Math.max(0, opts.max - skills.length) : singles.length;
    for (const { path, kind } of singles.slice(0, budget)) {
      try {
        const content = await fetchArtifactFile(target, tree.ref, path, opts);
        // Preserve the directory shape so filename-derived names (commands) stay correct.
        const localFile = join(dest, "singles", path);
        mkdirSync(join(localFile, ".."), { recursive: true });
        writeFileSync(localFile, content, "utf8");
        const res = await auditAsync(localFile, ctx, kind);
        skills.push({ ...res, repoPath: path });
      } catch (err) {
        errors.push({ repoPath: path, message: err instanceof Error ? err.message : String(err) });
      }
    }
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
  return { ref: tree.ref, treeSha: tree.treeSha, truncated: tree.truncated, skills, errors };
}
