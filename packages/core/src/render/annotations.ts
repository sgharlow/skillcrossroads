/**
 * GitHub Actions workflow-command annotations: one `::warning`/`::error` line per non-pass
 * finding, anchored to the evidence's file:line so findings appear inline in the PR diff.
 * https://docs.github.com/actions/reference/workflow-commands-for-github-actions
 */
import type { Scorecard } from "../types.js";
import { checkDocsUrl } from "../badge-embed.js";

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

/** Normalize one path segment to POSIX form (drops "./" and trailing slashes, keeps ".claude"). */
function normalizeSeg(s: string): string {
  return s.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

/** Join path segments into a clean repo-relative POSIX path (drops "." segments, keeps ".claude"). */
function joinRepoPath(...segs: string[]): string {
  return segs
    .map(normalizeSeg)
    .filter((s) => s && s !== ".")
    .join("/");
}

/** True when `base` ends with `suffix` as WHOLE path segments (`foo/abar` never matches `bar`). */
function endsWithSegments(base: string, suffix: string): boolean {
  return base === suffix || base.endsWith(`/${suffix}`);
}

/**
 * Join (pathPrefix, repoPath, evidenceFile) into a `file=` anchor with segment-aware dedup.
 * When the scan TARGET is the artifact itself, the pieces overlap: a single-dir scan's repoPath
 * falls back to the target's basename (already the prefix's last segment), and a single-file
 * scan's evidence file IS the target file. Dedup drops a piece only when the joined base already
 * ends with it as whole segments — `a/vulnerable-old` never dedups against `vulnerable`.
 */
function annotationFile(pathPrefix: string, repoPath: string, evidenceFile: string): string {
  const prefix = normalizeSeg(pathPrefix);
  const repo = normalizeSeg(repoPath);
  const base =
    prefix && repo && repo !== "." && endsWithSegments(prefix, repo) ? prefix : joinRepoPath(prefix, repo);
  const evFile = normalizeSeg(evidenceFile);
  return base && evFile && endsWithSegments(base, evFile) ? base : joinRepoPath(base, evFile);
}

/**
 * Render annotation lines for every warn/fail finding. `pathPrefix` is the scanned root relative
 * to the repository root (the Action's `path` input) so `file=` anchors resolve in the PR diff.
 * A single-file artifact's evidence file IS its repoPath (its own .md), so segments deduplicate.
 */
export function renderAnnotations(results: readonly AnnotatableResult[], pathPrefix = "", siteUrl?: string): string[] {
  const lines: string[] = [];
  for (const r of results) {
    for (const check of r.scorecard.results) {
      if (check.status === "pass") continue;
      const level = check.status === "fail" ? "error" : "warning";
      const ev = check.evidence[0];
      const evFile = ev?.file ?? "";
      const file = annotationFile(pathPrefix, r.repoPath, evFile);
      const line = ev?.line ?? 1;
      // Ends with the check's reference page so the inline annotation carries its own fix guide.
      const msg = `[${check.id}] ${r.name}: ${ev?.message ?? check.title}${check.fix ? ` Fix: ${check.fix}` : ""} (${checkDocsUrl(check.id, siteUrl)})`;
      lines.push(
        `::${level} file=${propEscape(file)},line=${line},title=${propEscape(`Skill Crossroads ${check.id}`)}::${cmdEscape(msg)}`,
      );
    }
  }
  return lines;
}
