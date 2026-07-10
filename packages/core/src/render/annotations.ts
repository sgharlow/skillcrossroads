/**
 * GitHub Actions workflow-command annotations: one `::warning`/`::error` line per non-pass
 * finding, anchored to the evidence's file:line so findings appear inline in the PR diff.
 * https://docs.github.com/actions/reference/workflow-commands-for-github-actions
 */
import type { Scorecard } from "../types.js";

export interface AnnotatableResult {
  /** Path of the artifact inside the scanned root ("." for a single-artifact scan). */
  readonly repoPath: string;
  readonly name: string;
  readonly scorecard: Scorecard;
}

/** Escape data for a workflow-command message (GitHub's own %-encoding rules). */
function cmdEscape(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/** Escape a workflow-command property value (adds `:` and `,`). */
function propEscape(s: string): string {
  return cmdEscape(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/** Join path segments into a clean repo-relative POSIX path (drops "." segments, keeps ".claude"). */
function joinRepoPath(...segs: string[]): string {
  return segs
    .map((s) => s.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, ""))
    .filter((s) => s && s !== ".")
    .join("/");
}

/**
 * Render annotation lines for every warn/fail finding. `pathPrefix` is the scanned root relative
 * to the repository root (the Action's `path` input) so `file=` anchors resolve in the PR diff.
 * A single-file artifact's evidence file IS its repoPath (its own .md), so segments deduplicate.
 */
export function renderAnnotations(results: readonly AnnotatableResult[], pathPrefix = ""): string[] {
  const lines: string[] = [];
  for (const r of results) {
    for (const check of r.scorecard.results) {
      if (check.status === "pass") continue;
      const level = check.status === "fail" ? "error" : "warning";
      const ev = check.evidence[0];
      const evFile = ev?.file ?? "";
      // repoPath may already end with the evidence file (single-file agents/commands).
      const file = r.repoPath.endsWith(evFile) && evFile
        ? joinRepoPath(pathPrefix, r.repoPath)
        : joinRepoPath(pathPrefix, r.repoPath, evFile);
      const line = ev?.line ?? 1;
      const msg = `[${check.id}] ${r.name}: ${ev?.message ?? check.title}${check.fix ? ` Fix: ${check.fix}` : ""}`;
      lines.push(
        `::${level} file=${propEscape(file)},line=${line},title=${propEscape(`Skill Crossroads ${check.id}`)}::${cmdEscape(msg)}`,
      );
    }
  }
  return lines;
}
