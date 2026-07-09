import { scanGitHubRepo, letterGrade, type RepoScanResult } from "@beacon/core";

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

/** Scan a target with a short per-instance cache. Deterministic (no server LLM key in v0.1). */
export async function scanTarget(t: SlugTarget): Promise<RepoScanResult> {
  const hit = cache.get(t.slug);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.result;

  const result = await scanGitHubRepo(`${t.owner}/${t.repo}`, {}, {
    token: process.env.GITHUB_TOKEN,
    subpath: t.subpath,
    max: 25,
  });
  cache.set(t.slug, { at: now, result });
  return result;
}

/** Average overall score across a scan's skills (for a repo-level badge/summary). */
export function averageScore(result: RepoScanResult): number {
  if (result.skills.length === 0) return 0;
  return Math.round((result.skills.reduce((a, s) => a + s.scorecard.overall, 0) / result.skills.length) * 10) / 10;
}

export function averageGrade(result: RepoScanResult): string {
  return letterGrade(averageScore(result));
}
