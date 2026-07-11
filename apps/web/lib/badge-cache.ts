import { hasDb, getPool } from "./db";

/**
 * Last-known-good badge SVGs, keyed by scan slug (`owner/repo[/subpath]`, owner/repo lowercased
 * by the route — GitHub treats them case-insensitively).
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
  scannedAt: string; // ISO (UTC)
}

export interface BadgeCache {
  get(slug: string): Promise<BadgeCacheEntry | null>;
  /** Upsert the latest rendered SVG (last known good — errors are never cached). */
  put(slug: string, svg: string): Promise<void>;
  /** Drop a cached badge (e.g. the repo is gone — stop advertising its last grade). */
  delete(slug: string): Promise<void>;
}

/** Serve-stale window: past this age a cached badge is served AND refreshed in the background. */
export const BADGE_REFRESH_MS = 5 * 60 * 1000;

/**
 * Hard staleness ceiling: a cached badge older than this is NOT served — background refreshes
 * must have been failing for a week (repo deleted/private/renamed), so the route recomputes
 * inline and drops the row on failure rather than advertising a dead repo's grade forever.
 */
export const BADGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Growth bounds — the write path is anonymous-drivable by URL enumeration, so cap it. */
const MEMORY_MAX_ENTRIES = 2000;
const PG_MAX_ROWS = 50_000;

/** Is a cached badge due for a background refresh? Unparseable timestamps count as stale. */
export function isStale(scannedAt: string, now: number = Date.now()): boolean {
  const at = Date.parse(scannedAt);
  if (Number.isNaN(at)) return true;
  return now - at > BADGE_REFRESH_MS;
}

/** Past the hard ceiling (or unparseable) — do not serve; recompute inline. */
export function isExpired(scannedAt: string, now: number = Date.now()): boolean {
  const at = Date.parse(scannedAt);
  if (Number.isNaN(at)) return true;
  return now - at > BADGE_MAX_AGE_MS;
}

export function createMemoryBadgeCache(): BadgeCache {
  const entries = new Map<string, BadgeCacheEntry>();
  return {
    get(slug) {
      return Promise.resolve(entries.get(slug) ?? null);
    },
    put(slug, svg) {
      // Re-insert to keep Map order = recency, then evict the oldest past the cap.
      entries.delete(slug);
      entries.set(slug, { svg, scannedAt: new Date().toISOString() });
      if (entries.size > MEMORY_MAX_ENTRIES) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      return Promise.resolve();
    },
    delete(slug) {
      entries.delete(slug);
      return Promise.resolve();
    },
  };
}

export function createPgBadgeCache(pool: import("pg").Pool): BadgeCache {
  return {
    async get(slug) {
      // AT TIME ZONE 'UTC' before formatting — the appended literal "Z" must be a true UTC
      // claim regardless of the DB session timezone (this string drives isStale arithmetic).
      const res = await pool.query(
        `SELECT svg, to_char(scanned_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "scannedAt"
         FROM badge_cache WHERE slug = $1`,
        [slug],
      );
      return (res.rows[0] as BadgeCacheEntry | undefined) ?? null;
    },
    async put(slug, svg) {
      // Existing slugs always update (even at the cap); NEW rows are capped so anonymous URL
      // enumeration cannot grow the table without bound (each insert already costs a full scan).
      const upd = await pool.query("UPDATE badge_cache SET svg = $2, scanned_at = now() WHERE slug = $1", [
        slug,
        svg,
      ]);
      if (upd.rowCount === 0) {
        await pool.query(
          `INSERT INTO badge_cache (slug, svg, scanned_at)
           SELECT $1, $2, now()
           WHERE (SELECT count(*) FROM badge_cache) < $3
           ON CONFLICT (slug) DO UPDATE SET svg = EXCLUDED.svg, scanned_at = now()`,
          [slug, svg, PG_MAX_ROWS],
        );
      }
    },
    async delete(slug) {
      await pool.query("DELETE FROM badge_cache WHERE slug = $1", [slug]);
    },
  };
}

/** Process-wide singleton — Postgres when DATABASE_URL is set, else in-memory. */
export const badgeCache: BadgeCache = hasDb() ? createPgBadgeCache(getPool()) : createMemoryBadgeCache();
