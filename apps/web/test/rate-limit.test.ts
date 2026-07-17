import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  rateLimit,
  clientIp,
  _resetRateLimitStateForTests,
  _trackedKeyCountForTests,
  MAX_TRACKED_KEYS,
} from "../lib/rate-limit";

beforeEach(() => {
  _resetRateLimitStateForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks with a positive retryAfterSec", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit("k", opts)).toEqual({ allowed: true, retryAfterSec: 0 });
    expect(rateLimit("k", opts)).toEqual({ allowed: true, retryAfterSec: 0 });
    expect(rateLimit("k", opts)).toEqual({ allowed: true, retryAfterSec: 0 });
    const blocked = rateLimit("k", opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks distinct keys independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("a", opts).allowed).toBe(true);
    expect(rateLimit("a", opts).allowed).toBe(false);
    expect(rateLimit("b", opts).allowed).toBe(true);
  });

  it("expires old hits once the window passes, allowing again", () => {
    vi.useFakeTimers();
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("k", opts).allowed).toBe(true);
    expect(rateLimit("k", opts).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("k", opts).allowed).toBe(true);
  });

  it("retryAfterSec counts down as the window elapses", () => {
    vi.useFakeTimers();
    const opts = { limit: 1, windowMs: 10_000 };
    rateLimit("k", opts);
    const first = rateLimit("k", opts).retryAfterSec;
    vi.advanceTimersByTime(4000);
    const second = rateLimit("k", opts).retryAfterSec;
    expect(second).toBeLessThan(first);
  });

  it("a key that goes fully quiet for a window is pruned back out (memory doesn't grow forever for it)", () => {
    vi.useFakeTimers();
    const opts = { limit: 2, windowMs: 1000 };
    rateLimit("k", opts);
    rateLimit("k", opts);
    vi.advanceTimersByTime(1001);
    // The next call for "k" should see a fresh window (old hits pruned), not the stale pair.
    const res = rateLimit("k", opts);
    expect(res.allowed).toBe(true);
    expect(rateLimit("k", opts).allowed).toBe(true);
    expect(rateLimit("k", opts).allowed).toBe(false);
  });

  it("caps tracked keys at MAX_TRACKED_KEYS even under a flood of distinct keys", () => {
    const opts = { limit: 5, windowMs: 60_000 };
    for (let i = 0; i < MAX_TRACKED_KEYS + 500; i++) {
      rateLimit(`flood-${i}`, opts);
    }
    expect(_trackedKeyCountForTests()).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
    // The most recently inserted key must survive eviction (oldest goes first).
    expect(rateLimit(`flood-${MAX_TRACKED_KEYS + 499}`, opts).allowed).toBe(true);
    // Heavy loop (MAX_TRACKED_KEYS + 500 inserts) — the default 5s timeout is load-sensitive and
    // flakes when the full suite runs right after a build; give it headroom (passes ~3s idle).
  }, 15_000);
});

describe("clientIp", () => {
  it("prefers the first hop of x-forwarded-for", () => {
    const req = new Request("https://x.test", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("https://x.test", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(clientIp(req)).toBe("9.9.9.9");
  });

  it("falls back to \"unknown\" when neither header is present", () => {
    const req = new Request("https://x.test");
    expect(clientIp(req)).toBe("unknown");
  });
});
