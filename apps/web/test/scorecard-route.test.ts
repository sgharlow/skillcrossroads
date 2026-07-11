import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve } from "node:path";
import { audit, type RepoScanResult } from "@beacon/core";

// `after()` throws outside a request scope — no-op it so the handler runs in tests.
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/pro-scan", () => ({ resolveScanOptions: vi.fn(async () => ({ pro: false })) }));
vi.mock("@/lib/scan", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/scan")>();
  return { ...mod, scanTarget: vi.fn() };
});

import { GET } from "../app/s/[...slug]/route";
import { scanTarget } from "../lib/scan";
import { resolveScanOptions } from "../lib/pro-scan";

const scanTargetMock = vi.mocked(scanTarget);
const resolveScanOptionsMock = vi.mocked(resolveScanOptions);

function get(slug: string[]): Promise<Response> {
  return GET(new Request(`https://skillcrossroads.com/s/${slug.join("/")}`), {
    params: Promise.resolve({ slug }),
  });
}

/** A real single-skill scan result — renderHtml needs a genuine scorecard. */
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

beforeEach(() => {
  vi.clearAllMocks();
  resolveScanOptionsMock.mockResolvedValue({ pro: false });
});

describe("GET /s/[...slug] — error HTML escapes untrusted text (reflected XSS)", () => {
  it("escapes the error message on the 502 page — GitHubError messages can embed raw slug segments", async () => {
    scanTargetMock.mockRejectedValue(new Error('repo not found: <img src=x onerror="alert(1)">'));
    const res = await get(["o", "r"]);
    expect(res.status).toBe(502);
    const html = await res.text();
    expect(html).not.toContain("<img");
    expect(html).toContain('&lt;img src=x onerror="alert(1)"&gt;');
  });

  it("escapes the slug on the 404 no-skills page", async () => {
    scanTargetMock.mockResolvedValue({ skills: [], errors: [] } as unknown as RepoScanResult);
    const res = await get(["o", "r", "<script>alert(1)</script>"]);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("GET /s/[...slug] — Pro responses never enter the shared CDN cache", () => {
  it("anonymous scans stay publicly cacheable", async () => {
    scanTargetMock.mockResolvedValue(goodScan());
    const res = await get(["o", "r", "good-skill"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=300, stale-while-revalidate=600");
  });

  it("a private-token (Pro) scan is private, no-store — even without ?suggest=1", async () => {
    resolveScanOptionsMock.mockResolvedValue({ pro: true, token: "gho_private" });
    scanTargetMock.mockResolvedValue(goodScan());
    const res = await get(["o", "r", "good-skill"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("a managed-LLM (Pro) scan is private, no-store", async () => {
    resolveScanOptionsMock.mockResolvedValue({
      pro: true,
      ctx: { model: { name: "stub", generateStructured: async () => ({}) } },
    });
    scanTargetMock.mockResolvedValue(goodScan());
    const res = await get(["o", "r", "good-skill"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
