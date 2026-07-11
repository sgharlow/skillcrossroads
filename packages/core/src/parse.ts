import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Artifact, ArtifactType } from "./types.js";

const ENTRY_FILENAME = "SKILL.md";
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", ".beacon-cache"]);

export class ParseError extends Error {}

/** Convert an OS path to POSIX separators for stable, cross-platform evidence paths. */
function toPosix(p: string): string {
  return p.split(sep).join("/");
}

/**
 * Locate the entry file for a skill. Accepts either the skill directory or a direct
 * path to `SKILL.md`. Match is case-insensitive on the filename.
 */
function resolveEntry(inputPath: string): { root: string; entryPath: string } {
  const abs = resolve(inputPath);
  if (!existsSync(abs)) {
    throw new ParseError(`Path does not exist: ${inputPath}`);
  }
  const st = statSync(abs);
  if (st.isFile()) {
    const normalized = toPosix(abs).toLowerCase();
    if (!normalized.endsWith(`/${ENTRY_FILENAME.toLowerCase()}`)) {
      throw new ParseError(`Not a ${ENTRY_FILENAME} file: ${inputPath}`);
    }
    return { root: resolve(abs, ".."), entryPath: abs };
  }
  // Directory: find SKILL.md (case-insensitive).
  const entries = readdirSync(abs);
  const match = entries.find((e) => e.toLowerCase() === ENTRY_FILENAME.toLowerCase());
  if (!match) {
    throw new ParseError(
      `No ${ENTRY_FILENAME} found in ${inputPath} — is this a Claude Code skill directory?`,
    );
  }
  return { root: abs, entryPath: join(abs, match) };
}

/**
 * Split a document into YAML frontmatter and body.
 * Frontmatter must be a `---`-fenced block at the very top of the file.
 */
export function splitFrontmatter(raw: string): {
  frontmatter: Record<string, unknown> | null;
  frontmatterError: string | null;
  body: string;
  bodyStartLine: number;
} {
  // Normalize CRLF for splitting, but preserve content semantics.
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return { frontmatter: null, frontmatterError: null, body: raw, bodyStartLine: 1 };
  }
  // Find the closing fence.
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return {
      frontmatter: null,
      frontmatterError: "Frontmatter opened with `---` but was never closed.",
      body: raw,
      bodyStartLine: 1,
    };
  }
  const fmText = lines.slice(1, close).join("\n");
  const body = lines.slice(close + 1).join("\n");
  const bodyStartLine = close + 2; // 1-indexed line of first body line
  try {
    const parsed = parseYaml(fmText);
    if (parsed === null || parsed === undefined) {
      return { frontmatter: {}, frontmatterError: null, body, bodyStartLine };
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        frontmatter: null,
        frontmatterError: "Frontmatter is not a YAML mapping (key: value pairs).",
        body,
        bodyStartLine,
      };
    }
    return {
      frontmatter: parsed as Record<string, unknown>,
      frontmatterError: null,
      body,
      bodyStartLine,
    };
  } catch (err) {
    return {
      frontmatter: null,
      frontmatterError: err instanceof Error ? err.message : String(err),
      body,
      bodyStartLine,
    };
  }
}

/** Recursively list files under `root` (relative POSIX paths), excluding ignored dirs. */
function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (IGNORED_DIRS.has(name)) continue;
        walk(full);
      } else if (st.isFile()) {
        out.push(toPosix(relative(root, full)));
      }
    }
  };
  walk(root);
  return out.sort();
}

interface IgnoreRule {
  readonly re: RegExp;
  /** Trailing `/` in the pattern — matches directories only. */
  readonly dir: boolean;
  /** Leading `/` (or an inner `/`) — anchored to the plugin root. */
  readonly anchored: boolean;
  /** Segment count of the (anchored) pattern. */
  readonly segCount: number;
}

/** Escape regex specials, translating `*` to a within-segment wildcard. */
function globToRegExp(pat: string): RegExp {
  const body = pat
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${body}$`);
}

/**
 * Minimal `.gitignore` matcher for plugin trees. Gitignored files don't ship via git-based
 * marketplace installs, so they are not part of the published plugin — sweeping them into the
 * scan (e.g. a local-only `.env.local`) makes SAFETY-01 flag files no installer ever receives.
 * (`--plugin-dir` users still see them locally via a plain skill/file scan.)
 *
 * Supported: comment/blank lines skipped; trailing `/` = directory prefix; leading `/` (or an
 * inner `/`) = root-anchored; `*` wildcard within a segment; plain names match any path segment.
 * `!` negation lines are unsupported and skipped entirely (never cause an exclusion).
 */
function gitignoreMatcher(root: string): (rel: string) => boolean {
  const giPath = join(root, ".gitignore");
  if (!existsSync(giPath)) return () => false;
  const rules: IgnoreRule[] = [];
  for (const rawLine of readFileSync(giPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    let pat = line;
    const dir = pat.endsWith("/");
    if (dir) pat = pat.replace(/\/+$/, "");
    let anchored = false;
    if (pat.startsWith("/")) {
      anchored = true;
      pat = pat.replace(/^\/+/, "");
    } else if (pat.includes("/")) {
      anchored = true; // a slash anywhere anchors the pattern (git semantics)
    }
    if (!pat) continue;
    rules.push({ re: globToRegExp(pat), dir, anchored, segCount: pat.split("/").length });
  }
  if (rules.length === 0) return () => false;
  return (rel: string): boolean => {
    const segs = rel.split("/");
    return rules.some((rule) => {
      if (rule.anchored) {
        // Match a prefix of the path at a segment boundary; a dir pattern must be a strict
        // prefix (a directory containing the file), a file pattern may also be the file itself.
        if (rule.dir ? segs.length <= rule.segCount : segs.length < rule.segCount) return false;
        return rule.re.test(segs.slice(0, rule.segCount).join("/"));
      }
      // Plain name: any segment (dir patterns must match a non-final segment).
      return (rule.dir ? segs.slice(0, -1) : segs).some((s) => rule.re.test(s));
    });
  };
}

/**
 * Infer the artifact kind from a path: `SKILL.md` (or a dir containing one) → skill; a `.md`
 * file under an `agents/` directory (any depth) → subagent; under `commands/` → command
 * (nearest ancestor wins — namespaced layouts like `commands/git/commit.md`). Returns null
 * when the path is ambiguous (caller should require an explicit kind).
 */
export function detectKind(inputPath: string): ArtifactType | null {
  const abs = resolve(inputPath);
  const posix = toPosix(abs).toLowerCase();
  if (posix.endsWith("/.claude-plugin/plugin.json")) return "plugin";
  if (posix.endsWith("/skill.md")) return "skill";
  if (posix.endsWith(".mcp.json")) return "mcp"; // `.mcp.json` or `<name>.mcp.json`
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    const entries = readdirSync(abs);
    // A root SKILL.md keeps the dir a skill even when a plugin manifest exists — single-artifact
    // flows must not silently downgrade prose grading to a manifest scan. (Batch scans via
    // scanLocalDir emit both rows regardless.) Only manifest-without-root-SKILL.md dirs are plugins.
    if (entries.some((e) => e.toLowerCase() === ENTRY_FILENAME.toLowerCase())) return "skill";
    if (existsSync(join(abs, ".claude-plugin", "plugin.json"))) return "plugin";
    return null;
  }
  if (posix.endsWith(".md")) {
    const ancestors = posix.split("/").slice(0, -1);
    for (let i = ancestors.length - 1; i >= 0; i--) {
      if (ancestors[i] === "agents") return "subagent";
      if (ancestors[i] === "commands") return "command";
    }
  }
  return null;
}

/**
 * Parse a Claude Code artifact into an Artifact.
 *  - `skill`: a directory containing SKILL.md (or the SKILL.md path) — supporting files listed.
 *  - `subagent` / `command`: a single `.md` file (`.claude/agents/*.md`, `.claude/commands/*.md`);
 *    single-file artifacts have no supporting-file list — sibling agents are NOT this artifact's files.
 */
export function parse(inputPath: string, type: ArtifactType = "skill"): Artifact {
  // MCP Phase A: the artifact is a `.mcp.json` config file — raw JSON, no frontmatter/body.
  if (type === "mcp") {
    const abs = resolve(inputPath);
    if (!existsSync(abs)) throw new ParseError(`Path does not exist: ${inputPath}`);
    if (!statSync(abs).isFile() || !toPosix(abs).toLowerCase().endsWith(".json")) {
      throw new ParseError(`An mcp artifact is a .mcp.json file — got: ${inputPath}`);
    }
    const raw = readFileSync(abs, "utf8");
    return {
      type,
      root: resolve(abs, ".."),
      entryPath: abs,
      raw,
      frontmatter: null,
      frontmatterError: null,
      body: "",
      bodyStartLine: 1,
      files: [],
    };
  }
  // Plugin: the artifact is the plugin DIRECTORY; its entry is `.claude-plugin/plugin.json`.
  // `files` lists the whole plugin tree so component-resolution and secret checks see it.
  if (type === "plugin") {
    let abs = resolve(inputPath);
    if (!existsSync(abs)) throw new ParseError(`Path does not exist: ${inputPath}`);
    if (statSync(abs).isFile()) {
      // A file input must be the manifest itself, like the sibling branches validate their entry.
      if (!toPosix(abs).toLowerCase().endsWith("/.claude-plugin/plugin.json")) {
        throw new ParseError(`A plugin file input must be .claude-plugin/plugin.json — got: ${inputPath}`);
      }
      abs = resolve(abs, "..", ".."); // plugin.json path → plugin root
    }
    const entryPath = join(abs, ".claude-plugin", "plugin.json");
    if (!existsSync(entryPath)) {
      throw new ParseError(`No .claude-plugin/plugin.json found in ${inputPath} — is this a plugin directory?`);
    }
    const raw = readFileSync(entryPath, "utf8");
    const entryRel = toPosix(relative(abs, entryPath));
    const ignored = gitignoreMatcher(abs);
    return {
      type,
      root: abs,
      entryPath,
      raw,
      frontmatter: null,
      frontmatterError: null,
      body: "",
      bodyStartLine: 1,
      files: listFiles(abs).filter((f) => f !== entryRel && !ignored(f)),
    };
  }
  if (type === "subagent" || type === "command") {
    const abs = resolve(inputPath);
    if (!existsSync(abs)) throw new ParseError(`Path does not exist: ${inputPath}`);
    if (!statSync(abs).isFile() || !toPosix(abs).toLowerCase().endsWith(".md")) {
      throw new ParseError(`A ${type} is a single .md file — got: ${inputPath}`);
    }
    const raw = readFileSync(abs, "utf8");
    const { frontmatter, frontmatterError, body, bodyStartLine } = splitFrontmatter(raw);
    return {
      type,
      root: resolve(abs, ".."),
      entryPath: abs,
      raw,
      frontmatter,
      frontmatterError,
      body,
      bodyStartLine,
      files: [],
    };
  }
  if (type !== "skill") {
    throw new ParseError(`Artifact type "${type}" is not supported yet (skill, subagent, command).`);
  }
  const { root, entryPath } = resolveEntry(inputPath);
  const raw = readFileSync(entryPath, "utf8");
  const { frontmatter, frontmatterError, body, bodyStartLine } = splitFrontmatter(raw);
  const entryRel = toPosix(relative(root, entryPath));
  const files = listFiles(root).filter((f) => f !== entryRel);
  return {
    type,
    root,
    entryPath,
    raw,
    frontmatter,
    frontmatterError,
    body,
    bodyStartLine,
    files,
  };
}
