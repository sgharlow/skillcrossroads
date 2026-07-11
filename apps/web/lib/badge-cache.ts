import { hasDb, getPool } from "./db";

/**
 * Last-known-good badge SVGs, keyed by scan slug (`owner/repo[/subpath]`).
 *
 * Why: a cold badge render scans the repo (~5–6 s), which can outlast GitHub camo's ~4 s proxy
 * timeout — an embedded badge that intermittently breaks at CDN-cache expiry. Serving the last
 * rendered SVG from the DB makes steady-state badge latency one SELECT, and a background
 * refresh (`after()`) keeps it current. Only ANONYMOUS renders are cached — Pro-optioned scans
 * (private token / managed LLM) bypass this store entirely so a keyed grade can never leak
 * into the public badge.
 */
export interface BadgeCacheEntry {
  svg: string;
  scannedAt: string; // ISO
}

export interface BadgeCache {
  get(slug: string): Promise<BadgeCacheEntry | null>;
  /** Upsert the latest rendered SVG (last known good — errors are never cached). */
  put(slug: string, svg: string): Promise<void>;
}

/** Serve-stale window: past this age a cached badge is served AND refreshed in the background. */
export const BADGE_REFRESH_MS = 5 * 60 * 1000;

/** Is a cached badge due for a background refresh? Unparseable timestamps count as stale. */
export function isStale(scannedAt: string, now: number = Date.now()): boolean {
  const at = Date.parse(scannedAt);
  if (Number.isNaN(at)) return true;
  return now - at > BADGE_REFRESH_MS;
}

export function createMemoryBadgeCache(): BadgeCache {
  const entries = new Map<string, BadgeCacheEntry>();
  return {
    get(slug) {
      return Promise.resolve(entries.get(slug) ?? null);
    },
    put(slug, svg) {
      entries.set(slug, { svg, scannedAt: new Date().toISOString() });
      return Promise.resolve();
    },
  };
}

export function createPgBadgeCache(pool: import("pg").Pool): BadgeCache {
  return {
    async get(slug) {
      const res = await pool.query(
        `SELECT svg, to_char(scanned_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "scannedAt"
         FROM badge_cache WHERE slug = $1`,
        [slug],
      );
      return (res.rows[0] as BadgeCacheEntry | undefined) ?? null;
    },
    async put(slug, svg) {
      await pool.query(
        `INSERT INTO badge_cache (slug, svg, scanned_at) VALUES ($1, $2, now())
         ON CONFLICT (slug) DO UPDATE SET svg = EXCLUDED.svg, scanned_at = now()`,
        [slug, svg],
      );
    },
  };
}

/** Process-wide singleton — Postgres when DATABASE_URL is set, else in-memory. */
export const badgeCache: BadgeCache = hasDb() ? createPgBadgeCache(getPool()) : createMemoryBadgeCache();
