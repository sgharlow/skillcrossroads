import { scanGitHubRepo, letterGrade, GitHubError, type RepoScanResult, type CheckContext } from "@beacon/core";

export interface SlugTarget {
  owner: string;
  repo: string;
  /** Repo subpath restricting the scan to one skill (or a subtree). */
  subpath?: string;
  /** Canonical `owner/repo[/subpath]` slug string. */
  slug: string;
}

/** Parse a catch-all route slug (`owner/repo/[...subpath]`) into a scan target. */
export function parseSlug(slug: string[]): SlugTarget | null {
  const parts = slug.filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo, ...rest] = parts;
  const subpath = rest.length ? rest.join("/") : undefined;
  return { owner: owner as string, repo: repo as string, subpath: subpath ?? undefined, slug: parts.join("/") };
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; result: RepoScanResult }>();

export interface ScanOptions {
  /** GitHub token — a Pro user's OAuth token for private repos; else the server token. */
  token?: string;
  /** Check context — carries the managed LLM model for Pro users. */
  ctx?: CheckContext;
}

/**
 * Scan a target. Free/public scans (no token, deterministic) are cached per-instance; authenticated
 * Pro scans (private repos and/or managed LLM) are user-specific and never cached.
 */
export async function scanTarget(t: SlugTarget, opts: ScanOptions = {}): Promise<RepoScanResult> {
  const cacheable = !opts.token && !opts.ctx?.model;
  if (cacheable) {
    const hit = cache.get(t.slug);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
  }

  const result = await scanGitHubRepo(`${t.owner}/${t.repo}`, opts.ctx ?? {}, {
    token: opts.token ?? process.env.GITHUB_TOKEN,
    subpath: t.subpath,
    max: 25,
  });

  if (cacheable) cache.set(t.slug, { at: Date.now(), result });
  return result;
}

/**
 * Classify a `scanTarget` rejection so route handlers can respond correctly without leaking
 * internals. A GitHub 404 means the repo doesn't exist (or is private) — a stable, user-facing
 * "not found" condition worth a 404 page. Everything else (rate limits, network errors, GitHub
 * 5xx) is transient and deserves a retry-soon 503. Classification only — does not change what
 * `scanTarget` throws.
 */
export function isRepoNotFoundError(err: unknown): boolean {
  return err instanceof GitHubError && /GitHub API 404 for/.test(err.message);
}

/** Average overall score across a scan's skills (for a repo-level badge/summary). */
export function averageScore(result: RepoScanResult): number {
  if (result.skills.length === 0) return 0;
  return Math.round((result.skills.reduce((a, s) => a + s.scorecard.overall, 0) / result.skills.length) * 10) / 10;
}

export function averageGrade(result: RepoScanResult): string {
  return letterGrade(averageScore(result));
}
