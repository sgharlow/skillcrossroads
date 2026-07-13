import { parseGitHubSlug } from "@beacon/core";

/**
 * A repo owner/name is `[A-Za-z0-9]` with interior `-` for the owner, `[A-Za-z0-9._-]` for the
 * repo (GitHub's own username/reponame rules) — kept strict so the redirect target built from it
 * can only ever be a same-origin `/s/...` path segment, never something that reads as a scheme or
 * a protocol-relative host.
 */
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const REPO_RE = /^[A-Za-z0-9._-]+$/;

function safeSlug(owner: string, repo: string): string | null {
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo)) return null;
  return `${owner}/${repo}`;
}

/**
 * Parse a `repo` form/query value (bare `owner/repo`, or a GitHub URL / git remote) into a
 * validated `owner/repo` slug — or `null` on anything that doesn't resolve to one. Never returns
 * anything other than the two path segments: callers always build the redirect as a same-origin
 * `/s/<slug>` path, so this can't become an open redirect no matter what garbage is submitted.
 */
export function resolveRepoSlug(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Full GitHub URL / git remote — the one authoritative parser (never hand-roll this regex).
  const parsed = parseGitHubSlug(trimmed);
  if (parsed) return safeSlug(parsed.owner, parsed.repo);

  // Bare "owner/repo" (no scheme) — the common case from the plain-text input.
  const bare = trimmed.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
  const parts = bare.split("/");
  if (parts.length !== 2) return null;
  const [owner, repo] = parts as [string, string];
  return safeSlug(owner, repo);
}
