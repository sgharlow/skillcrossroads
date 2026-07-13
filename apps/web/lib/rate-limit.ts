/**
 * Per-IP / per-key rate limiting for the hosted app's scan endpoints.
 *
 * LIMITATION (accepted, by design): this is a per-SERVERLESS-INSTANCE, in-memory sliding-window
 * limiter — there is no shared store (no Redis/Upstash) behind it. On a platform that scales out
 * to N concurrent instances, the effective ceiling for a given key is N × `limit`, not a hard
 * global cap. That's fine here: the goal is to stop ONE hot instance (and, for the badge cold-
 * scan cap, one instance's GitHub calls) from burning the single shared `GITHUB_TOKEN` at launch-
 * traffic peaks, not to provide a precise global quota. A real global limit needs a shared store
 * — out of scope for the free-tier, zero-new-deps requirement here.
 */

export interface RateLimitOptions {
  /** Max allowed hits per key within the window. */
  limit: number;
  /** Sliding window size, in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller should retry. 0 when `allowed` is true. */
  retryAfterSec: number;
}

/** key -> ascending timestamps (ms) of hits still inside some caller's window. */
const buckets = new Map<string, number[]>();

/**
 * Any key untouched for longer than this is swept on the next `pruneStaleKeys()` pass, bounding
 * memory even for keys that get a single hit and are never seen again (a distinct-IP flood).
 * Generous relative to every window this app actually uses (max 5 min) so it never prunes a key
 * still inside its caller's real window.
 */
const STALE_KEY_MS = 30 * 60 * 1000;

/** Sweep triggers once the tracked-key count crosses this — most traffic never gets here. */
const SWEEP_THRESHOLD = 5000;

/**
 * Hard ceiling on distinct tracked keys — bounds worst-case memory even under a distinct-key flood
 * (e.g. many spoofed IPs) that arrives faster than `pruneStaleKeys` reaps idle entries. Mirrors the
 * LRU-style cap in badge-cache.ts's memory store: re-insert on touch to keep Map order = recency,
 * then evict the oldest entry once the cap is crossed.
 */
export const MAX_TRACKED_KEYS = 20_000;

function pruneStaleKeys(now: number): void {
  for (const [key, hits] of buckets) {
    const last = hits[hits.length - 1];
    if (last === undefined || now - last > STALE_KEY_MS) buckets.delete(key);
  }
}

/**
 * Record a hit for `key` and report whether it's within `opts.limit` in the trailing
 * `opts.windowMs`. Sliding-window log: prunes timestamps older than the window on every call, so
 * a key that goes quiet for a whole window naturally empties back out (and is deleted, not just
 * emptied — bounds memory for keys that stop being used).
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let hits = buckets.get(key);
  if (hits) {
    const kept = hits.filter((t) => t > cutoff);
    if (kept.length) {
      hits = kept;
      buckets.set(key, hits);
    } else {
      buckets.delete(key);
      hits = undefined;
    }
  }

  if (hits && hits.length >= opts.limit) {
    const oldest = hits[0] as number;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  const next = hits ?? [];
  next.push(now);
  // Re-insert to keep Map order = recency, then evict the oldest entry past the hard cap.
  buckets.delete(key);
  buckets.set(key, next);
  if (buckets.size > MAX_TRACKED_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }

  if (buckets.size > SWEEP_THRESHOLD) pruneStaleKeys(now);

  return { allowed: true, retryAfterSec: 0 };
}

/** Test-only: drop all tracked state so suites don't bleed into each other. */
export function _resetRateLimitStateForTests(): void {
  buckets.clear();
}

/** Test-only: current tracked-key count, to assert the hard cap in `MAX_TRACKED_KEYS` holds. */
export function _trackedKeyCountForTests(): number {
  return buckets.size;
}

/**
 * Best-effort client IP for per-IP limiting: first hop of `X-Forwarded-For` (the nearest proxy's
 * view of the client — trustworthy behind a platform edge like Vercel's, which OVERWRITES this
 * header at its edge rather than trusting/forwarding whatever the client supplied, so the first
 * entry is the platform's own view of the real client IP, not attacker-controlled), falling back
 * to `X-Real-IP`, else "unknown" (all IP-less traffic shares one bucket — still bounds the worst
 * case rather than skipping the limit entirely).
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}
