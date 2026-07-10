import { describe, it, expect } from "vitest";
import { parseGitHubUrl, isGitHubUrl, findSkillDirs, GitHubError, type TreeEntry } from "../src/github.js";
import { scanGitHubRepo } from "../src/index.js";

describe("isGitHubUrl", () => {
  it("accepts URLs and owner/repo shorthand", () => {
    expect(isGitHubUrl("https://github.com/a/b")).toBe(true);
    expect(isGitHubUrl("github.com/a/b")).toBe(true);
    expect(isGitHubUrl("owner/repo")).toBe(true);
  });
  it("rejects local paths", () => {
    expect(isGitHubUrl("./my-skill")).toBe(false);
    expect(isGitHubUrl("/abs/path")).toBe(false);
    expect(isGitHubUrl("C:/x/y")).toBe(false);
    expect(isGitHubUrl("just-one-segment")).toBe(false);
  });
});

describe("parseGitHubUrl", () => {
  it("parses a bare repo URL", () => {
    expect(parseGitHubUrl("https://github.com/anthropics/skills")).toEqual({
      owner: "anthropics",
      repo: "skills",
      ref: undefined,
      subpath: undefined,
    });
  });
  it("parses a tree URL with ref and subpath", () => {
    expect(parseGitHubUrl("https://github.com/o/r/tree/main/skills/foo")).toEqual({
      owner: "o",
      repo: "r",
      ref: "main",
      subpath: "skills/foo",
    });
  });
  it("strips .git and accepts shorthand", () => {
    expect(parseGitHubUrl("o/r.git")).toMatchObject({ owner: "o", repo: "r" });
  });
  it("throws on garbage", () => {
    expect(() => parseGitHubUrl("nope")).toThrow(GitHubError);
  });
});

describe("findSkillDirs", () => {
  const tree: TreeEntry[] = [
    { path: "README.md", type: "blob" },
    { path: "skills/foo/SKILL.md", type: "blob" },
    { path: "skills/foo/references/x.md", type: "blob" },
    { path: "skills/bar/SKILL.md", type: "blob" },
    { path: "other/baz/SKILL.md", type: "blob" },
  ];
  it("finds every skill directory", () => {
    expect(findSkillDirs(tree)).toEqual(["other/baz", "skills/bar", "skills/foo"]);
  });
  it("restricts to a subpath", () => {
    expect(findSkillDirs(tree, "skills")).toEqual(["skills/bar", "skills/foo"]);
  });
});

describe("scanGitHubRepo (mock fetch)", () => {
  const SKILL_MD = `---
name: mock-skill
description: A mock skill for testing the repo scanner end to end against the live pipeline. Use when the user says "test the scanner" or "run the mock scan fixture".
---
# Mock skill
See [the reference](./references/x.md).
`;

  function mockFetch(url: string): Promise<Response> {
    const u = url.toString();
    if (u === "https://api.github.com/repos/o/r") {
      return Promise.resolve(new Response(JSON.stringify({ default_branch: "main" })));
    }
    if (u.includes("/git/trees/main")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            sha: "deadbeefcafe",
            truncated: false,
            tree: [
              { path: "skills/foo/SKILL.md", type: "blob" },
              { path: "skills/foo/references/x.md", type: "blob" },
              { path: "skills/foo/evals/check.md", type: "blob" }, // v1.1: VERIFY-01 needs evals
            ],
          }),
        ),
      );
    }
    if (u.endsWith("/skills/foo/SKILL.md")) return Promise.resolve(new Response(SKILL_MD));
    if (u.endsWith("/skills/foo/references/x.md")) return Promise.resolve(new Response("# ref\n"));
    if (u.endsWith("/skills/foo/evals/check.md")) return Promise.resolve(new Response("# eval\n"));
    return Promise.resolve(new Response("not found", { status: 404 }));
  }

  it("scans a repo end to end and grades each skill", async () => {
    const scan = await scanGitHubRepo("o/r", {}, { fetchImpl: mockFetch as unknown as typeof fetch });
    expect(scan.ref).toBe("main");
    expect(scan.treeSha).toBe("deadbeefcafe");
    expect(scan.skills).toHaveLength(1);
    const skill = scan.skills[0]!;
    expect(skill.repoPath).toBe("skills/foo");
    expect(skill.name).toBe("mock-skill");
    // clean skill, deterministic-only → all deterministic checks pass
    expect(skill.scorecard.results.find((r) => r.id === "STRUCT-05")?.status).toBe("pass");
    expect(skill.scorecard.grade).toBe("A+");
  });
});
