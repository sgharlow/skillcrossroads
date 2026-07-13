import { describe, it, expect } from "vitest";
import {
  badgeUrls,
  badgeMarkdown,
  badgeMarkdownLine,
  parseGitHubSlug,
  insertBadge,
  newReadme,
} from "../src/badge-embed.js";

const SITE = "https://skillcrossroads.com";

describe("badgeUrls", () => {
  it("builds the hosted badge + scorecard URL shapes", () => {
    expect(badgeUrls(SITE, "sgharlow", "orchestra-lite")).toEqual({
      badgeUrl: "https://skillcrossroads.com/api/badge/sgharlow/orchestra-lite.svg",
      scorecardUrl: "https://skillcrossroads.com/s/sgharlow/orchestra-lite",
    });
  });
  it("tolerates a trailing slash on the site URL", () => {
    const { badgeUrl } = badgeUrls("https://skillcrossroads.com/", "a", "b");
    expect(badgeUrl).toBe("https://skillcrossroads.com/api/badge/a/b.svg");
  });

  // Deep-link slugs (e.g. /s/owner/repo/path/to/skill) restrict a scan to one skill inside a repo
  // — the hosted /s route needs the badge+scorecard URLs to carry that subpath too.
  it("appends an optional subpath segment for deep-link slugs", () => {
    expect(badgeUrls(SITE, "o", "r", "path/to/skill")).toEqual({
      badgeUrl: "https://skillcrossroads.com/api/badge/o/r/path/to/skill.svg",
      scorecardUrl: "https://skillcrossroads.com/s/o/r/path/to/skill",
    });
  });
  it("matches the plain owner/repo shape when subpath is omitted or empty", () => {
    expect(badgeUrls(SITE, "o", "r", undefined)).toEqual(badgeUrls(SITE, "o", "r"));
    expect(badgeUrls(SITE, "o", "r", "")).toEqual(badgeUrls(SITE, "o", "r"));
  });
});

describe("badgeMarkdownLine", () => {
  it("builds the bare linked-badge markdown line from a pre-built {badgeUrl, scorecardUrl} pair", () => {
    expect(
      badgeMarkdownLine({
        badgeUrl: "https://skillcrossroads.com/api/badge/o/r.svg",
        scorecardUrl: "https://skillcrossroads.com/s/o/r",
      }),
    ).toBe("[![Skill Crossroads](https://skillcrossroads.com/api/badge/o/r.svg)](https://skillcrossroads.com/s/o/r)");
  });
});

describe("badgeMarkdown", () => {
  it("includes the linked badge and caption by default", () => {
    const md = badgeMarkdown({ siteUrl: SITE, owner: "sgharlow", repo: "comment-conspiracy" });
    expect(md).toContain("[![Skill Crossroads](https://skillcrossroads.com/api/badge/sgharlow/comment-conspiracy.svg)]");
    expect(md).toContain("(https://skillcrossroads.com/s/sgharlow/comment-conspiracy)");
    expect(md).toContain("Claude Code artifacts graded by [Skill Crossroads](https://skillcrossroads.com)");
  });
  it("omits the caption when caption:false (bare linked badge — matches the web embed <pre>)", () => {
    const md = badgeMarkdown({ siteUrl: SITE, owner: "a", repo: "b", caption: false });
    expect(md).toBe("[![Skill Crossroads](https://skillcrossroads.com/api/badge/a/b.svg)](https://skillcrossroads.com/s/a/b)");
    expect(md).not.toContain("graded by");
  });
});

describe("parseGitHubSlug", () => {
  it.each([
    ["git@github.com:sgharlow/mdlink-check.git", "sgharlow", "mdlink-check"],
    ["git@github.com:sgharlow/mdlink-check", "sgharlow", "mdlink-check"],
    ["ssh://git@github.com/acme/Repo.Name.git", "acme", "Repo.Name"],
    ["https://github.com/anthropics/skills.git", "anthropics", "skills"],
    ["https://github.com/anthropics/skills", "anthropics", "skills"],
    ["https://x-access-token:TOKEN@github.com/owner/repo.git", "owner", "repo"],
    ["https://github.com/owner/repo/", "owner", "repo"],
  ])("parses %s", (url, owner, repo) => {
    expect(parseGitHubSlug(url)).toEqual({ owner, repo });
  });

  it.each([
    "git@gitlab.com:owner/repo.git",
    "https://bitbucket.org/owner/repo.git",
    "not a url",
    "https://github.com/owner", // missing repo
    "",
  ])("returns null for non-GitHub / malformed: %s", (url) => {
    expect(parseGitHubSlug(url)).toBeNull();
  });
});

describe("insertBadge", () => {
  const block = "[![Skill Crossroads](https://skillcrossroads.com/api/badge/o/r.svg)](https://skillcrossroads.com/s/o/r)";

  it("inserts one blank line + the block under the first H1, keeping the body", () => {
    const readme = "# My Project\n\nSome intro text.\n";
    const { content, changed, reason } = insertBadge(readme, block);
    expect(changed).toBe(true);
    expect(reason).toBe("inserted");
    expect(content).toBe(`# My Project\n\n${block}\n\nSome intro text.\n`);
  });

  it("normalizes when the H1 is immediately followed by body (no blank line)", () => {
    const readme = "# Title\nBody right away";
    const { content } = insertBadge(readme, block);
    expect(content).toBe(`# Title\n\n${block}\n\nBody right away`);
  });

  it("prepends when there is no H1", () => {
    const readme = "Just some notes, no heading.\n";
    const { content, changed } = insertBadge(readme, block);
    expect(changed).toBe(true);
    expect(content).toBe(`${block}\n\nJust some notes, no heading.\n`);
  });

  it("is idempotent — a README that already has a hosted badge is unchanged", () => {
    const readme = `# Title\n\n${block}\n\nBody\n`;
    const { content, changed, reason } = insertBadge(readme, block);
    expect(changed).toBe(false);
    expect(reason).toBe("already-present");
    expect(content).toBe(readme);
  });

  it("detects an existing badge from any host (self-hosted) so it never double-inserts", () => {
    const readme = "# Title\n\n[![x](https://my.mirror.example/api/badge/o/r.svg)](https://my.mirror.example/s/o/r)\n";
    expect(insertBadge(readme, block).changed).toBe(false);
  });

  it("does not treat a non-badge svg as an existing badge", () => {
    const readme = "# Title\n\n![logo](./assets/logo.svg)\n";
    expect(insertBadge(readme, block).changed).toBe(true);
  });

  it("ignores a badge URL inside a fenced code block (docs example, not an embedded badge)", () => {
    const readme =
      "# Title\n\nEmbed the hosted badge:\n\n```markdown\n" +
      "[![Skill Crossroads](https://skillcrossroads.com/api/badge/OWNER/REPO.svg)](https://skillcrossroads.com/s/OWNER/REPO)\n" +
      "```\n\nBody\n";
    const { changed, reason } = insertBadge(readme, block);
    expect(changed).toBe(true);
    expect(reason).toBe("inserted");
  });

  it("ignores a badge URL inside an inline code span", () => {
    const readme = "# Title\n\nUse `https://skillcrossroads.com/api/badge/o/r.svg` as the image URL.\n";
    expect(insertBadge(readme, block).changed).toBe(true);
  });

  it("still detects a real badge when a docs example is ALSO present in a code fence", () => {
    const readme =
      `# Title\n\n${block}\n\n` +
      "```markdown\n[![Skill Crossroads](https://skillcrossroads.com/api/badge/OWNER/REPO.svg)](https://skillcrossroads.com/s/OWNER/REPO)\n```\n";
    const { changed, reason } = insertBadge(readme, block);
    expect(changed).toBe(false);
    expect(reason).toBe("already-present");
  });
});

describe("newReadme", () => {
  it("produces a minimal README with H1, the badge block, and a fill-in hint", () => {
    const md = newReadme("my-repo", "BADGE");
    expect(md.startsWith("# my-repo\n\nBADGE\n")).toBe(true);
    expect(md).toContain("<!-- Add a description");
  });
});
