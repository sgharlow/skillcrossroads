import { hasDb, getPool } from "./db";

/**
 * Badge-serve instrumentation — the "badges in the wild" leading indicator.
 *
 * Every origin hit on `/api/badge/...` records one row: the repo slug and whether the request
 * came from GitHub's camo image proxy (user-agent `github-camo`) — camo is how README images are
 * fetched, so a camo serve means the badge is embedded on a GitHub page someone just viewed.
 * Honest floor, not a total: CDN-cached serves never reach the origin, so the count UNDERSTATES
 * reality. That is fine for a leading indicator — the number moving is the signal.
 * Fire-and-forget: recording must never slow or fail a badge response.
 */
export interface BadgeServeStats {
  /** Distinct repos served to GitHub's camo proxy in the window — badges live in READMEs. */
  reposOnGitHub: number;
  /** Total origin badge serves in the window (all sources, cache misses only). */
  totalServes: number;
  windowDays: number;
}

export interface BadgeServes {
  record(slug: string, userAgent: string | null): Promise<void>;
  stats(windowDays?: number): Promise<BadgeServeStats>;
}

const GITHUB_UA = /github-camo/i;

export function createMemoryBadgeServes(): BadgeServes {
  const rows: Array<{ slug: string; github: boolean; at: number }> = [];
  return {
    record(slug, userAgent) {
      rows.push({ slug, github: GITHUB_UA.test(userAgent ?? ""), at: Date.now() });
      return Promise.resolve();
    },
    stats(windowDays = 30) {
      const cutoff = Date.now() - windowDays * 86_400_000;
      const inWindow = rows.filter((r) => r.at >= cutoff);
      const github = new Set(inWindow.filter((r) => r.github).map((r) => r.slug));
      return Promise.resolve({ reposOnGitHub: github.size, totalServes: inWindow.length, windowDays });
    },
  };
}

export function createPgBadgeServes(pool: import("pg").Pool): BadgeServes {
  return {
    async record(slug, userAgent) {
      await pool.query(`INSERT INTO badge_serves (slug, from_github) VALUES ($1, $2)`, [
        slug,
        GITHUB_UA.test(userAgent ?? ""),
      ]);
    },
    async stats(windowDays = 30) {
      const res = await pool.query(
        `SELECT count(*)::int AS total,
                count(DISTINCT slug) FILTER (WHERE from_github)::int AS github_repos
         FROM badge_serves WHERE served_at >= now() - make_interval(days => $1)`,
        [windowDays],
      );
      return { reposOnGitHub: res.rows[0].github_repos, totalServes: res.rows[0].total, windowDays };
    },
  };
}

/** Process-wide singleton — Postgres when DATABASE_URL is set, else in-memory. */
export const badgeServes: BadgeServes = hasDb() ? createPgBadgeServes(getPool()) : createMemoryBadgeServes();
