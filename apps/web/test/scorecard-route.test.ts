import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve } from "node:path";
import { audit, GitHubError, type RepoScanResult } from "@beacon/core";

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
  it("escapes the slug on the 404 no-skills page", async () => {
    scanTargetMock.mockResolvedValue({ skills: [], errors: [] } as unknown as RepoScanResult);
    const res = await get(["o", "r", "<script>alert(1)</script>"]);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes the hostile slug on the repo-not-found 404 page too", async () => {
    scanTargetMock.mockRejectedValue(new GitHubError("GitHub API 404 for https://api.github.com/repos/o/%3Cscript%3E"));
    const res = await get(["o", "<script>alert(1)</script>"]);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("GET /s/[...slug] — scan failures classify into a branded 404 or 503, no internal leak", () => {
  it("a GitHub 404 (repo doesn't exist / is private) renders a branded 404 with the escaped slug", async () => {
    scanTargetMock.mockRejectedValue(
      new GitHubError("GitHub API 404 for https://api.github.com/repos/nonexistent-owner-zz9/nonexistent-repo-zz9"),
    );
    const res = await get(["nonexistent-owner-zz9", "nonexistent-repo-zz9"]);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("nonexistent-owner-zz9/nonexistent-repo-zz9");
    expect(html).not.toContain("api.github.com");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/paste"');
    expect(html).toContain("Repo not found");
  });

  it("a non-404 GitHubError (rate limit / GitHub 5xx) renders a branded 503, no internal leak", async () => {
    scanTargetMock.mockRejectedValue(new GitHubError("GitHub API 503 for https://api.github.com/repos/o/r"));
    const res = await get(["o", "r"]);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).not.toContain("api.github.com");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/paste"');
  });

  it("a network/other failure (not a GitHubError at all) also renders a branded 503", async () => {
    scanTargetMock.mockRejectedValue(new Error("fetch failed: ECONNRESET"));
    const res = await get(["o", "r"]);
    expect(res.status).toBe(503);
    const html = await res.text();
    expect(html).not.toContain("ECONNRESET");
    expect(html).not.toContain("api.github.com");
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

describe("GET /s/[...slug] — embed badge URLs use the badge-embed.ts URL contract (byte-identical)", () => {
  // Pinned before centralizing the hand-built badgeUrl/scorecardUrl template literals onto
  // badgeUrls() from @beacon/core/badge-embed.ts — must stay byte-identical after.
  it("plain owner/repo slug", async () => {
    scanTargetMock.mockResolvedValue(goodScan());
    const res = await get(["o", "r"]);
    const html = await res.text();
    expect(html).toContain(
      "[![Skill Crossroads](https://skillcrossroads.com/api/badge/o/r.svg)](https://skillcrossroads.com/s/o/r)",
    );
  });

  it("deep-link slug with a subpath (single-skill scan restricted to a subtree)", async () => {
    scanTargetMock.mockResolvedValue(goodScan());
    const res = await get(["o", "r", "good-skill"]);
    const html = await res.text();
    expect(html).toContain(
      "[![Skill Crossroads](https://skillcrossroads.com/api/badge/o/r/good-skill.svg)](https://skillcrossroads.com/s/o/r/good-skill)",
    );
  });
});
