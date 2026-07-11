import { describe, it, expect } from "vitest";
import { createMemoryBadgeCache, isStale, BADGE_REFRESH_MS } from "../lib/badge-cache";
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

  it("put overwrites (last known good)", async () => {
    const cache = createMemoryBadgeCache();
    await cache.put("o/r", "<svg>A</svg>");
    await cache.put("o/r", "<svg>B</svg>");
    expect((await cache.get("o/r"))?.svg).toBe("<svg>B</svg>");
  });

  it("isStale is false within the refresh window and true past it", () => {
    const now = Date.now();
    expect(isStale(new Date(now - 1000).toISOString(), now)).toBe(false);
    expect(isStale(new Date(now - BADGE_REFRESH_MS - 1000).toISOString(), now)).toBe(true);
    // Unparseable timestamps count as stale (refresh rather than serve forever).
    expect(isStale("not-a-date", now)).toBe(true);
  });
});

describe("GET /api/badge — serve-from-cache path (the camo-timeout fix)", () => {
  it("an anonymous request with a cached badge serves it instantly, no scan", async () => {
    await badgeCache.put("cached-owner/cached-repo", "<svg>CACHED</svg>");
    const req = new Request("https://skillcrossroads.com/api/badge/cached-owner/cached-repo.svg");
    const started = Date.now();
    const res = await GET(req, { params: Promise.resolve({ slug: ["cached-owner", "cached-repo.svg"] }) });
    expect(Date.now() - started).toBeLessThan(1500); // no GitHub scan happened
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(await res.text()).toBe("<svg>CACHED</svg>");
  });

  it("rejects a bad badge path", async () => {
    const req = new Request("https://skillcrossroads.com/api/badge/only-owner.svg");
    const res = await GET(req, { params: Promise.resolve({ slug: ["only-owner.svg"] }) });
    expect(res.status).toBe(400);
  });
});
