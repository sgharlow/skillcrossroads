import type { ScannedSkill } from "@beacon/core";
import { scanHistory } from "./scans";
import { gallery } from "./gallery";

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
  const scannedAt = new Date().toISOString().slice(0, 10);
  return Promise.all(
    skills.map((s) => {
      const categoryScores: Record<string, number | null> = {};
      for (const c of s.scorecard.categories) categoryScores[c.key] = c.score;
      const slug = slugFor(owner, repo, s.repoPath);
      const historyWrite = scanHistory
        .record({
          slug,
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
      // Keep a gallery entry (if this artifact is listed) from going stale against the live
      // scorecard — best-effort, never inserts (opt-in stays deliberate). See lib/gallery.ts.
      const galleryRefresh = gallery
        .refreshIfListed(slug, s.name, s.scorecard.grade, s.scorecard.overall, scannedAt)
        .catch(() => {
          /* refresh is best-effort */
        });
      return Promise.all([historyWrite, galleryRefresh]);
    }),
  ).then(() => undefined);
}
