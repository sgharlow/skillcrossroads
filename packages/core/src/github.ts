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
  const localName = (skillDir || target.repo).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "skill";
  const localRoot = join(destRoot, localName);

  const blobs = tree.entries.filter(
    (e) => e.type === "blob" && (skillDir === "" || e.path.startsWith(prefix)),
  );

  let contentFetched = 0;
  for (const blob of blobs) {
    const rel = skillDir === "" ? blob.path : blob.path.slice(prefix.length);
    const outPath = join(localRoot, rel);
    mkdirSync(dirname(outPath), { recursive: true });
    const isEntry = posix.basename(rel).toLowerCase() === "skill.md";
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
