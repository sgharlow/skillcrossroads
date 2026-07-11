import { describe, it, expect } from "vitest";
import { createMemoryBadgeCache, isStale, isExpired, BADGE_REFRESH_MS, BADGE_MAX_AGE_MS } from "../lib/badge-cache";
import { GET } from "../app/api/badge/[...slug]/route";
import { badgeCache } from "../lib/badge-cache";

describe("badge cache store", () => {
  it("misses on unknown slugs and round-trips a put", async () => {
    const cache = createMemoryBadgeCache();
    expect(await cache.get("o/r")).toBeNull();
    await cache.put("o/r", "<svg>A</svg>");
    const hit = await cache.get("o/r");
    expect(hit?.svg).toBe("<svg>A</svg>");
    expect(typeof hit?.scannedAt).toBe("string");
  });

  it("put overwrites (last known good) and delete drops the entry", async () => {
    const cache = createMemoryBadgeCache();
    await cache.put("o/r", "<svg>A</svg>");
    await cache.put("o/r", "<svg>B</svg>");
    expect((await cache.get("o/r"))?.svg).toBe("<svg>B</svg>");
    await cache.delete("o/r");
    expect(await cache.get("o/r")).toBeNull();
  });

  it("the in-memory store is bounded: old entries evict past the cap", async () => {
    const cache = createMemoryBadgeCache();
    for (let i = 0; i < 2001; i++) await cache.put(`o/r${i}`, "<svg/>");
    expect(await cache.get("o/r0")).toBeNull(); // oldest evicted
    expect(await cache.get("o/r2000")).not.toBeNull();
  });

  it("isStale is false within the refresh window and true past it", () => {
    const now = Date.now();
    expect(isStale(new Date(now - 1000).toISOString(), now)).toBe(false);
    expect(isStale(new Date(now - BADGE_REFRESH_MS - 1000).toISOString(), now)).toBe(true);
    // Unparseable timestamps count as stale (refresh rather than serve forever).
    expect(isStale("not-a-date", now)).toBe(true);
  });

  it("isExpired only trips past the hard ceiling (serve-stale stops, inline recompute takes over)", () => {
    const now = Date.now();
    expect(isExpired(new Date(now - BADGE_REFRESH_MS - 1000).toISOString(), now)).toBe(false);
    expect(isExpired(new Date(now - BADGE_MAX_AGE_MS - 1000).toISOString(), now)).toBe(true);
    expect(isExpired("not-a-date", now)).toBe(true);
  });
});

describe("GET /api/badge — serve-from-cache path (the camo-timeout fix)", () => {
  it("an anonymous request with a cached badge serves it verbatim (a scan would render a different SVG)", async () => {
    await badgeCache.put("cached-owner/cached-repo", "<svg>CACHED</svg>");
    const req = new Request("https://skillcrossroads.com/api/badge/cached-owner/cached-repo.svg");
    const res = await GET(req, { params: Promise.resolve({ slug: ["cached-owner", "cached-repo.svg"] }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    // Anonymous badges are CDN-cacheable; the sentinel body proves no scan replaced the cache hit.
    expect(res.headers.get("cache-control")).toContain("public");
    expect(await res.text()).toBe("<svg>CACHED</svg>");
  });

  it("differently-cased owner/repo hit the same cache entry (GitHub is case-insensitive)", async () => {
    await badgeCache.put("case-owner/case-repo", "<svg>ONE</svg>");
    const req = new Request("https://skillcrossroads.com/api/badge/Case-Owner/Case-Repo.svg");
    const res = await GET(req, { params: Promise.resolve({ slug: ["Case-Owner", "Case-Repo.svg"] }) });
    expect(await res.text()).toBe("<svg>ONE</svg>");
  });

  it("rejects a bad badge path", async () => {
    const req = new Request("https://skillcrossroads.com/api/badge/only-owner.svg");
    const res = await GET(req, { params: Promise.resolve({ slug: ["only-owner.svg"] }) });
    expect(res.status).toBe(400);
  });
});
