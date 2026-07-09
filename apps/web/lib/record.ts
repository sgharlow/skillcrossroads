import type { ScannedSkill } from "@beacon/core";
import { scanHistory } from "./scans";

/** Build the canonical `owner/repo/path` slug for a scanned skill. */
export function slugFor(owner: string, repo: string, repoPath: string): string {
  const path = repoPath === "(root)" ? "" : repoPath;
  return [owner, repo, path].filter(Boolean).join("/");
}

/** Record each scored skill into the score-history store. Fire-and-forget — never fails a scan. */
export function recordScans(owner: string, repo: string, skills: readonly ScannedSkill[]): void {
  for (const s of skills) {
    const categoryScores: Record<string, number | null> = {};
    for (const c of s.scorecard.categories) categoryScores[c.key] = c.score;
    void scanHistory
      .record({
        slug: slugFor(owner, repo, s.repoPath),
        name: s.name,
        grade: s.scorecard.grade,
        overall: s.scorecard.overall,
        rubricVersion: s.scorecard.rubricVersion,
        categoryScores,
      })
      .catch(() => {
        /* recording is best-effort */
      });
  }
}
