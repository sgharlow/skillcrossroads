import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve } from "node:path";

// `after()` throws outside a request scope — no-op it so the handler runs synchronously in tests
// (this also means the fire-and-forget badgeCache.put after a fresh scan never actually fires here).
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/pro-scan", () => ({ resolveScanOptions: vi.fn(async () => ({ pro: false })) }));
vi.mock("@/lib/scan", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/scan")>();
  return { ...mod, scanTarget: vi.fn() };
});

import { GET } from "../app/api/badge/[...slug]/route";
import { scanTarget } from "../lib/scan";
import { badgeCache } from "../lib/badge-cache";
import { _resetRateLimitStateForTests } from "../lib/rate-limit";
import { audit, type RepoScanResult } from "@beacon/core";

const scanTargetMock = vi.mocked(scanTarget);

/** A real single-skill scan result — renderBadge needs a genuine scorecard. */
function goodScan(): RepoScanResult {
  const res = audit(resolve("packages/core/test/fixtures/skills/good-skill"));
  return {
    ref: "main",
    treeSha: "abc123",
    truncated: false,
    errors: [],
    skills: [{ ...res, repoPath: "good-skill" }],
  } as unknown as RepoScanResult;
}

function get(owner: string, repo: string): Promise<Response> {
  const slug = [owner, `${repo}.svg`];
  return GET(new Request(`https://skillcrossroads.com/api/badge/${owner}/${repo}.svg`), {
    params: Promise.resolve({ slug }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitStateForTests();
  scanTargetMock.mockResolvedValue(goodScan());
});

describe("GET /api/badge — cold-scan global cap (badges must never break / never 429)", () => {
  it("scans the first 30 brand-new slugs normally", async () => {
    for (let i = 0; i < 30; i++) {
      const res = await get(`owner${i}`, `repo${i}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/svg+xml");
    }
    expect(scanTargetMock).toHaveBeenCalledTimes(30);
  });

  it("the 31st distinct new slug is served an 'n/a' placeholder (short cache) instead of scanning — still 200, never 429", async () => {
    for (let i = 0; i < 30; i++) await get(`o${i}`, `r${i}`);
    expect(scanTargetMock).toHaveBeenCalledTimes(30);

    const res = await get("owner-over-cap", "repo-over-cap");
    expect(res.status).toBe(200);
    expect(scanTargetMock).toHaveBeenCalledTimes(30); // the 31st did NOT trigger a scan
    const svg = await res.text();
    expect(svg).toContain("n/a");
    expect(res.headers.get("cache-control")).toContain("s-maxage=30");
    expect(res.headers.get("cache-control")).not.toContain("s-maxage=300");
  });

  it("an already-cached slug is served from cache regardless of the cold cap (no scan, no placeholder)", async () => {
    for (let i = 0; i < 30; i++) await get(`p${i}`, `q${i}`);
    await badgeCache.put("warm-owner/warm-repo", "<svg>WARM</svg>");
    const before = scanTargetMock.mock.calls.length;

    const res = await get("warm-owner", "warm-repo");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<svg>WARM</svg>");
    expect(scanTargetMock.mock.calls.length).toBe(before);
  });
});
