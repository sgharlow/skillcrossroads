/**
 * badge-embed — the ONE authoritative definition of the hosted-badge contract.
 *
 * The badge URL shape (`/api/badge/OWNER/REPO.svg`), the scorecard URL shape (`/s/OWNER/REPO`),
 * and the README markdown block that links them are the growth loop's core primitive. They must
 * be expressed in exactly one place so the CLI (`init`), the web scorecard's "embed this badge"
 * snippet, and the HTML renderer never drift. Pure string functions — no I/O.
 */

/** Strip a trailing slash so `${base}/api/...` never doubles up. */
function trimSite(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

/** The canonical hosted origin — the default everywhere a caller doesn't override the site URL. */
export const DEFAULT_SITE_URL = "https://skillcrossroads.com";

/** The per-check reference page (`/docs/checks/<id>`) — linked from every finding, every surface. */
export function checkDocsUrl(checkId: string, siteUrl: string = DEFAULT_SITE_URL): string {
  return `${trimSite(siteUrl)}/docs/checks/${checkId.toLowerCase()}`;
}

/** The hosted badge + scorecard URLs for a repo — the single source of the URL shapes. */
export function badgeUrls(siteUrl: string, owner: string, repo: string): { badgeUrl: string; scorecardUrl: string } {
  const base = trimSite(siteUrl);
  const slug = `${owner}/${repo}`;
  return { badgeUrl: `${base}/api/badge/${slug}.svg`, scorecardUrl: `${base}/s/${slug}` };
}

export interface BadgeMarkdownOptions {
  siteUrl: string;
  owner: string;
  repo: string;
  /** Include the one-line caption under the badge (default true). `false` = bare linked badge. */
  caption?: boolean;
}

/**
 * The canonical README badge block: an always-fresh badge that links to the full scorecard,
 * optionally followed by the caption line. This is what `init` inserts and what the scorecard
 * page tells authors to copy.
 */
export function badgeMarkdown(opts: BadgeMarkdownOptions): string {
  const { badgeUrl, scorecardUrl } = badgeUrls(opts.siteUrl, opts.owner, opts.repo);
  const line = `[![Skill Crossroads](${badgeUrl})](${scorecardUrl})`;
  if (opts.caption === false) return line;
  return (
    `${line}\n\n` +
    `Claude Code artifacts graded by [Skill Crossroads](${trimSite(opts.siteUrl)}) — ` +
    `click the badge for the evidence-cited scorecard.`
  );
}

/**
 * Parse a GitHub remote URL into `{ owner, repo }`, or `null` if it isn't a GitHub remote.
 * Handles the three forms `git remote get-url origin` actually returns:
 *   git@github.com:owner/repo.git
 *   ssh://git@github.com/owner/repo.git
 *   https://github.com/owner/repo(.git)     (optionally with a token/user@ prefix)
 */
export function parseGitHubSlug(remote: string): { owner: string; repo: string } | null {
  const s = remote.trim();
  const m =
    /^git@github\.com:([^/\s]+)\/(.+?)(?:\.git)?\/?$/.exec(s) ??
    /^ssh:\/\/git@github\.com\/([^/\s]+)\/(.+?)(?:\.git)?\/?$/.exec(s) ??
    /^https?:\/\/(?:[^@/]+@)?github\.com\/([^/\s]+)\/(.+?)(?:\.git)?\/?$/.exec(s);
  if (!m) return null;
  const owner = m[1]?.trim();
  const repo = m[2]?.trim();
  if (!owner || !repo) return null;
  return { owner, repo };
}

export interface InsertBadgeResult {
  content: string;
  changed: boolean;
  reason: "inserted" | "already-present";
}

/** True if the README already carries a hosted Skill Crossroads badge (any host, for self-hosting). */
const HOSTED_BADGE_RX = /\/api\/badge\/[^\s)]+\.svg/i;

/**
 * Insert a badge block just under the README's first level-1 heading (idempotent).
 * If the README already has a hosted badge, it's returned unchanged. If there's no H1, the block
 * is prepended. Never commits — the caller writes the file and the user reviews the diff.
 */
export function insertBadge(readme: string, block: string): InsertBadgeResult {
  if (HOSTED_BADGE_RX.test(readme)) return { content: readme, changed: false, reason: "already-present" };
  const lines = readme.split("\n");
  const h1 = lines.findIndex((l) => /^#\s+\S/.test(l));
  if (h1 === -1) {
    const sep = readme.length > 0 ? "\n\n" : "";
    return { content: `${block}${sep}${readme}`, changed: true, reason: "inserted" };
  }
  const after = lines.slice(h1 + 1);
  // Keep exactly one blank line between the badge block and whatever followed the H1.
  const tail = after[0] === "" ? after : ["", ...after];
  const out = [...lines.slice(0, h1 + 1), "", block, ...tail].join("\n");
  return { content: out, changed: true, reason: "inserted" };
}

/** A minimal README for a repo that has none — H1, the badge block, and a fill-in hint. */
export function newReadme(repo: string, badgeBlock: string): string {
  return `# ${repo}\n\n${badgeBlock}\n\n<!-- Add a description of your project here. -->\n`;
}
