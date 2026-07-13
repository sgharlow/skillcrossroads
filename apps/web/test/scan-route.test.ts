import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pro-scan", () => ({ resolveScanOptions: vi.fn(async () => ({ pro: false })) }));
vi.mock("@/lib/scan", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/scan")>();
  return { ...mod, scanTarget: vi.fn() };
});

import { GET } from "../app/api/scan/route";
import { resolveScanOptions } from "../lib/pro-scan";
import { scanTarget } from "../lib/scan";
import { _resetRateLimitStateForTests } from "../lib/rate-limit";
import type { RepoScanResult } from "@beacon/core";

const resolveScanOptionsMock = vi.mocked(resolveScanOptions);
const scanTargetMock = vi.mocked(scanTarget);

function req(ip: string, url = "https://skillcrossroads.com/api/scan?repo=o/r"): Request {
  return new Request(url, { headers: { "x-forwarded-for": ip } });
}

const EMPTY_SCAN = { ref: "main", treeSha: "abc123", truncated: false, skills: [], errors: [] } as unknown as RepoScanResult;

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitStateForTests();
  resolveScanOptionsMock.mockResolvedValue({ pro: false });
  scanTargetMock.mockResolvedValue(EMPTY_SCAN);
});

describe("GET /api/scan — per-IP rate limiting", () => {
  it("allows 10 anonymous requests from one IP, then 429s with Retry-After + no-store", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await GET(req("1.1.1.1"));
      expect(res.status).toBe(200);
    }
    const blocked = await GET(req("1.1.1.1"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(blocked.headers.get("cache-control")).toBe("no-store");
    const body = await blocked.json();
    expect(body.error).toBeTruthy();
  });

  it("tracks distinct IPs independently", async () => {
    for (let i = 0; i < 10; i++) expect((await GET(req("2.2.2.2"))).status).toBe(200);
    expect((await GET(req("3.3.3.3"))).status).toBe(200);
  });

  it("gives a signed-in Pro request a higher ceiling (60) than the anonymous limit (10)", async () => {
    resolveScanOptionsMock.mockResolvedValue({ pro: true });
    for (let i = 0; i < 11; i++) {
      const res = await GET(req("4.4.4.4"));
      expect(res.status).toBe(200);
    }
  });

  it("a bad/missing ?repo= 400s before consuming a rate-limit slot", async () => {
    const bad = new Request("https://skillcrossroads.com/api/scan", { headers: { "x-forwarded-for": "5.5.5.5" } });
    expect((await GET(bad)).status).toBe(400);
    for (let i = 0; i < 10; i++) expect((await GET(req("5.5.5.5"))).status).toBe(200);
  });
});
