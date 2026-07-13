import { describe, it, expect } from "vitest";
import { GET } from "../app/api/go/route";
import { resolveRepoSlug } from "../lib/repo-slug";

function req(qs: string): Request {
  return new Request(`https://skillcrossroads.com/api/go${qs}`);
}

describe("resolveRepoSlug — parses the no-JS scan-form fallback input", () => {
  it("accepts a bare owner/repo", () => {
    expect(resolveRepoSlug("anthropics/skills")).toBe("anthropics/skills");
  });

  it("accepts a full https GitHub URL (via parseGitHubSlug)", () => {
    expect(resolveRepoSlug("https://github.com/anthropics/skills")).toBe("anthropics/skills");
  });

  it("accepts a GitHub URL with a trailing .git", () => {
    expect(resolveRepoSlug("https://github.com/anthropics/skills.git")).toBe("anthropics/skills");
  });

  it("strips leading/trailing slashes on a bare slug", () => {
    expect(resolveRepoSlug("/anthropics/skills/")).toBe("anthropics/skills");
  });

  it("rejects empty input", () => {
    expect(resolveRepoSlug("")).toBeNull();
    expect(resolveRepoSlug("   ")).toBeNull();
  });

  it("rejects garbage with no owner/repo shape", () => {
    expect(resolveRepoSlug("not-a-repo-at-all")).toBeNull();
  });

  it("rejects a slug carrying a protocol-relative host (open-redirect attempt)", () => {
    expect(resolveRepoSlug("//evil.example.com/x")).toBeNull();
  });

  it("rejects a slug carrying an embedded scheme in the repo segment", () => {
    expect(resolveRepoSlug("owner/https:evil.example.com")).toBeNull();
  });
});

describe("GET /api/go — redirects to a same-origin /s/... path, never an open redirect", () => {
  it("valid slug redirects to /s/owner/repo", async () => {
    const res = await GET(req("?repo=anthropics/skills"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://skillcrossroads.com/s/anthropics/skills");
  });

  it("a full GitHub URL also redirects to /s/owner/repo", async () => {
    const res = await GET(req("?repo=" + encodeURIComponent("https://github.com/anthropics/skills")));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://skillcrossroads.com/s/anthropics/skills");
  });

  it("garbage input redirects home with an error flag, not an error page", async () => {
    const res = await GET(req("?repo=nonsense"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://skillcrossroads.com/?error=bad-repo");
  });

  it("missing repo param redirects home with the error flag", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://skillcrossroads.com/?error=bad-repo");
  });

  it("an attempted open redirect (protocol-relative host) never leaves the origin", async () => {
    const res = await GET(req("?repo=" + encodeURIComponent("//evil.example.com/x")));
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("https://skillcrossroads.com/")).toBe(true);
    expect(location).not.toContain("evil.example.com");
  });
});
