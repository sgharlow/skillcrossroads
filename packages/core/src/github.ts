import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, posix } from "node:path";

export class GitHubError extends Error {}

export interface GitHubTarget {
  owner: string;
  repo: string;
  /** Branch, tag, or commit sha. Undefined → repo default branch. */
  ref?: string;
  /** Restrict scanning to skills under this repo subpath. */
  subpath?: string;
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree" | string;
}

/** Does this string look like a GitHub repo reference (URL or owner/repo)? */
export function isGitHubUrl(input: string): boolean {
  const s = input.trim();
  if (/^https?:\/\//i.test(s) || /^(www\.)?github\.com\//i.test(s)) return true;
  // bare owner/repo shorthand — exactly two path-ish segments, no leading ./ or drive letter
  return /^[\w.-]+\/[\w.-]+$/.test(s) && !/^\.|^[a-zA-Z]:/.test(s);
}

/** Parse a GitHub repo URL (or `owner/repo` shorthand) into a target. */
export function parseGitHubUrl(input: string): GitHubTarget {
  let s = input.trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) throw new GitHubError(`Not a GitHub repo URL: ${input}`);
  const owner = parts[0] as string;
  const repo = (parts[1] as string).replace(/\.git$/, "");
  let ref: string | undefined;
  let subpath: string | undefined;
  if (parts[2] === "tree" || parts[2] === "blob") {
    ref = parts[3];
    const sub = parts.slice(4).join("/");
    subpath = sub || undefined;
  }
  return { owner, repo, ref, subpath };
}

const BINARY_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "pdf", "zip", "gz", "tar",
  "woff", "woff2", "ttf", "otf", "mp4", "mov", "mp3", "wav", "exe", "dll", "bin",
]);

function ext(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

export interface GitHubFetchOptions {
  /** GITHUB_TOKEN for higher rate limits (60/hr unauth → 5000/hr). */
  token?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

async function ghJson(url: string, opts: GitHubFetchOptions): Promise<unknown> {
  const doFetch = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "beacon-scanner",
  };
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  const res = await doFetch(url, { headers });
  if (!res.ok) {
    throw new GitHubError(`GitHub API ${res.status} for ${url}`);
  }
  return res.json();
}

export interface RepoTree {
  ref: string;
  /** The git tree sha — pins the exact content scanned (for reproducible reports). */
  treeSha: string;
  entries: TreeEntry[];
  truncated: boolean;
}

/** Fetch the recursive git tree for a repo at `ref` (or its default branch). */
export async function fetchRepoTree(target: GitHubTarget, opts: GitHubFetchOptions = {}): Promise<RepoTree> {
  let ref = target.ref;
  if (!ref) {
    const repo = (await ghJson(
      `https://api.github.com/repos/${target.owner}/${target.repo}`,
      opts,
    )) as { default_branch?: string };
    ref = repo.default_branch ?? "main";
  }
  const tree = (await ghJson(
    `https://api.github.com/repos/${target.owner}/${target.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    opts,
  )) as { sha?: string; tree?: TreeEntry[]; truncated?: boolean };
  return {
    ref,
    treeSha: tree.sha ?? ref,
    entries: tree.tree ?? [],
    truncated: Boolean(tree.truncated),
  };
}

/** Directories in the tree that contain a SKILL.md (each is one skill), optionally under `subpath`. */
export function findSkillDirs(entries: readonly TreeEntry[], subpath?: string): string[] {
  const norm = subpath ? subpath.replace(/^\/+|\/+$/g, "") : undefined;
  const dirs = new Set<string>();
  for (const e of entries) {
    if (e.type !== "blob") continue;
    if (!/(^|\/)SKILL\.md$/i.test(e.path)) continue;
    const dir = e.path.includes("/") ? posix.dirname(e.path) : "";
    if (norm && !(dir === norm || dir.startsWith(`${norm}/`))) continue;
    dirs.add(dir);
  }
  return [...dirs].sort();
}

/**
 * Single-file artifacts in the tree: subagents (`…/agents/*.md`), slash commands
 * (`…/commands/*.md`, README excluded), MCP configs (`.mcp.json` at any level), and plugin
 * manifests (`.claude-plugin/plugin.json` — each marks its parent dir as a plugin root). Honors
 * `subpath` (a containing dir OR the exact file path, so deep links to one artifact work).
 */
export function findArtifactFiles(
  entries: readonly TreeEntry[],
  subpath?: string,
): { agents: string[]; commands: string[]; mcp: string[]; plugins: string[] } {
  const norm = subpath ? subpath.replace(/^\/+|\/+$/g, "") : undefined;
  const inScope = (p: string): boolean => !norm || p === norm || p.startsWith(`${norm}/`);
  // Test/fixture trees are not shipped artifacts — excluding them keeps a repo's public
  // scorecard about what it SHIPS. (Skill discovery predates this rule and keeps its
  // methodology for report reproducibility; single-file discovery is a new surface.)
  const excluded = /(^|\/)(?:node_modules|\.git|tests?|__tests__|fixtures?)\//i;
  const agents: string[] = [];
  const commands: string[] = [];
  const mcp: string[] = [];
  const plugins: string[] = [];
  for (const e of entries) {
    if (e.type !== "blob" || !inScope(e.path)) continue;
    if (excluded.test(e.path) && !(norm && excluded.test(`${norm}/`))) continue; // explicit deep links into test trees still work
    const base = posix.basename(e.path);
    if (/(^|\/)agents\/[^/]+\.md$/i.test(e.path) && !/^readme\.md$/i.test(base)) agents.push(e.path);
    else if (/(^|\/)commands\/[^/]+\.md$/i.test(e.path) && !/^readme\.md$/i.test(base)) commands.push(e.path);
    else if (base === ".mcp.json") mcp.push(e.path);
    else if (/(^|\/)\.claude-plugin\/plugin\.json$/.test(e.path)) plugins.push(e.path);
  }
  return { agents: agents.sort(), commands: commands.sort(), mcp: mcp.sort(), plugins: plugins.sort() };
}

async function fetchRaw(
  target: GitHubTarget,
  ref: string,
  path: string,
  opts: GitHubFetchOptions,
): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const url = `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${ref}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const headers: Record<string, string> = { "user-agent": "beacon-scanner" };
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  const res = await doFetch(url, { headers });
  if (!res.ok) throw new GitHubError(`raw fetch ${res.status} for ${path}`);
  return res.text();
}

/** Fetch one single-file artifact's raw content (agents/commands/.mcp.json hosted scans). */
export async function fetchArtifactFile(
  target: GitHubTarget,
  ref: string,
  path: string,
  opts: GitHubFetchOptions = {},
): Promise<string> {
  return fetchRaw(target, ref, path, opts);
}

export interface MaterializeOptions extends GitHubFetchOptions {
  /** Max supporting text files to actually download (for the secret scan). Others are placeholders. */
  maxContentFiles?: number;
  /**
   * Called with the relative path of every non-binary text file that was NOT downloaded (skipped
   * for the rate-limit cap, or whose fetch failed) — i.e. a file whose content the secret scan
   * never saw. Lets the caller disclose partial coverage. Binary files are not reported (they
   * aren't secret-scanned anyway).
   */
  onPlaceholder?: (rel: string) => void;
}

// Encode path separators distinctly ("/" → "__") BEFORE slugging, so `a/b` and `a-b` don't collide
// into the same temp dir (which would mix their file lists / secret scans).
function slugDir(name: string): string {
  return name.replace(/\//g, "__").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Reconstruct one skill locally under `destRoot` and return its directory.
 *
 * To stay within GitHub rate limits we do the minimum download: every blob in the skill's subtree
 * becomes a file (so the file list is accurate — STRUCT-05 only needs names), but real content is
 * fetched only for SKILL.md (always) and a capped set of text files (so SAFETY-01 can scan for
 * secrets). Everything else is an empty placeholder. Only a SKILL.md fetch failure is fatal.
 */
export async function materializeSkill(
  target: GitHubTarget,
  skillDir: string,
  tree: RepoTree,
  destRoot: string,
  opts: MaterializeOptions = {},
): Promise<string> {
  const maxContent = opts.maxContentFiles ?? 12;
  const prefix = skillDir ? `${skillDir}/` : "";
  const localRoot = join(destRoot, slugDir(skillDir || target.repo) || "skill");

  const blobs = tree.entries.filter(
    (e) => e.type === "blob" && (skillDir === "" || e.path.startsWith(prefix)),
  );

  let contentFetched = 0;
  for (const blob of blobs) {
    const rel = skillDir === "" ? blob.path : blob.path.slice(prefix.length);
    const outPath = join(localRoot, rel);
    mkdirSync(dirname(outPath), { recursive: true });
    // Only THIS skill's own top-level SKILL.md is fatal. A nested `sub/SKILL.md` (a separately-scanned
    // skill) is just a supporting file here — its fetch failure must not abort the parent skill.
    const isEntry = rel.toLowerCase() === "skill.md";
    const isBinary = BINARY_EXT.has(ext(rel));
    const wantContent = isEntry || (!isBinary && contentFetched < maxContent);

    if (!wantContent) {
      writeFileSync(outPath, "", "utf8"); // placeholder — keeps the file list accurate
      if (!isBinary) opts.onPlaceholder?.(rel); // a text file we didn't scan for secrets
      continue;
    }
    try {
      const content = await fetchRaw(target, tree.ref, blob.path, opts);
      writeFileSync(outPath, content, "utf8");
      if (!isEntry) contentFetched++;
    } catch (err) {
      if (isEntry) throw err; // no SKILL.md content → this skill can't be graded
      writeFileSync(outPath, "", "utf8"); // supporting-file fetch failed (rate limit) → placeholder
      if (!isBinary) opts.onPlaceholder?.(rel);
    }
  }
  return localRoot;
}

const PLUGIN_MANIFEST = ".claude-plugin/plugin.json";

/** Max hook-config files fetched with real content per plugin (rate-limit cap for HOOK-01). */
const MAX_HOOK_FILES = 4;

/** Plugin-root-relative `.json` hook-config paths whose REAL content HOOK-01 needs to scan. */
function hookConfigPaths(manifestRaw: string, treeRels: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  if (treeRels.has("hooks/hooks.json")) out.add("hooks/hooks.json");
  try {
    const manifest: unknown = JSON.parse(manifestRaw);
    const h =
      typeof manifest === "object" && manifest !== null && !Array.isArray(manifest)
        ? (manifest as Record<string, unknown>)["hooks"]
        : undefined;
    const declared = typeof h === "string" ? [h] : Array.isArray(h) ? h.filter((x): x is string => typeof x === "string") : [];
    for (const p of declared) {
      const rel = p.replace(/^\.\//, "");
      if (rel.endsWith(".json") && treeRels.has(rel)) out.add(rel);
    }
  } catch {
    /* an unparseable manifest is PLUGIN-01's finding, not a materialization failure */
  }
  return [...out].slice(0, MAX_HOOK_FILES);
}

/**
 * Reconstruct one plugin locally under `destRoot` and return its root directory.
 *
 * Mirrors materializeSkill's minimum-download contract: real content is fetched only for the
 * manifest (always — PLUGIN-01/02/03 parse it) and up to MAX_HOOK_FILES hook-config `.json`
 * files (HOOK-01 must scan actual hook commands, not placeholders); every other blob under the
 * plugin root becomes an empty placeholder so the file list stays accurate (PLUGIN-02 resolves
 * component paths by name). Only a manifest fetch failure is fatal. `pluginRoot` is "" when the
 * repo root itself is the plugin.
 */
export async function materializePlugin(
  target: GitHubTarget,
  pluginRoot: string,
  tree: RepoTree,
  destRoot: string,
  opts: GitHubFetchOptions & Pick<MaterializeOptions, "onPlaceholder"> = {},
): Promise<string> {
  const prefix = pluginRoot ? `${pluginRoot}/` : "";
  // The "plugins" segment keeps a root-level plugin from colliding with a same-named skill slug.
  const localRoot = join(destRoot, "plugins", slugDir(pluginRoot || target.repo) || "plugin");

  const blobs = tree.entries.filter(
    (e) => e.type === "blob" && (pluginRoot === "" || e.path.startsWith(prefix)),
  );
  const rels = new Set(blobs.map((b) => (pluginRoot === "" ? b.path : b.path.slice(prefix.length))));

  const manifestRaw = await fetchRaw(target, tree.ref, `${prefix}${PLUGIN_MANIFEST}`, opts); // fatal: no manifest → not gradable
  const wantContent = new Set(hookConfigPaths(manifestRaw, rels));

  for (const blob of blobs) {
    const rel = pluginRoot === "" ? blob.path : blob.path.slice(prefix.length);
    const outPath = join(localRoot, rel);
    mkdirSync(dirname(outPath), { recursive: true });
    if (rel === PLUGIN_MANIFEST) {
      writeFileSync(outPath, manifestRaw, "utf8");
      continue;
    }
    if (wantContent.has(rel)) {
      try {
        writeFileSync(outPath, await fetchRaw(target, tree.ref, blob.path, opts), "utf8");
        continue;
      } catch {
        /* hook-config fetch failed (rate limit) → fall through to a placeholder */
      }
    }
    writeFileSync(outPath, "", "utf8"); // placeholder — keeps the file list accurate
    if (!BINARY_EXT.has(ext(rel))) opts.onPlaceholder?.(rel); // a text file whose content was never scanned
  }
  return localRoot;
}
