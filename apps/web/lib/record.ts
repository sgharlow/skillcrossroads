import type { ScannedSkill } from "@beacon/core";
import { scanHistory } from "./scans";

/** Build the canonical `owner/repo/path` slug for a scanned skill. */
export function slugFor(owner: string, repo: string, repoPath: string): string {
  const path = repoPath === "(root)" ? "" : repoPath;
  return [owner, repo, path].filter(Boolean).join("/");
}

/**
 * Record each scored skill into the score-history store. Best-effort — never fails a scan.
 * Returns a promise resolving when all writes settle, so callers can pass it to Next's `after()`
 * to keep the serverless function alive until the writes persist (otherwise they're dropped on
 * termination). Errors are swallowed per-write.
 */
export function recordScans(
  owner: string,
  repo: string,
  skills: readonly ScannedSkill[],
  login?: string,
  source?: string,
): Promise<void> {
  return Promise.all(
    skills.map((s) => {
      const categoryScores: Record<string, number | null> = {};
      for (const c of s.scorecard.categories) categoryScores[c.key] = c.score;
      return scanHistory
        .record({
          slug: slugFor(owner, repo, s.repoPath),
          name: s.name,
          grade: s.scorecard.grade,
          overall: s.scorecard.overall,
          rubricVersion: s.scorecard.rubricVersion,
          categoryScores,
          ...(login ? { login } : {}),
          ...(source ? { source } : {}),
        })
        .catch(() => {
          /* recording is best-effort */
        });
    }),
  ).then(() => undefined);
}
