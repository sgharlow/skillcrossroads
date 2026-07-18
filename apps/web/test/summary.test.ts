import { describe, it, expect } from "vitest";
import type { RepoScanResult } from "@beacon/core";
import { rowHref, renderRepoSummaryHtml } from "../lib/summary";
import type { SlugTarget } from "../lib/scan";

const t: SlugTarget = { owner: "o", repo: "r", slug: "o/r" };

describe("rowHref — summary rows link to a rescannable scorecard", () => {
  it("skill rows keep the skill-directory link", () => {
    expect(rowHref(t, { repoPath: "skills/x", artifact: { type: "skill" } })).toBe("/s/o/r/skills/x");
  });

  it("plugin rows deep-link to the manifest FILE (the exact-file path that rescans to one row)", () => {
    expect(rowHref(t, { repoPath: "my-plugin", artifact: { type: "plugin" } })).toBe(
      "/s/o/r/my-plugin/.claude-plugin/plugin.json",
    );
  });

  it("a repo-root plugin ('(root)') links to /s/owner/repo/.claude-plugin/plugin.json", () => {
    expect(rowHref(t, { repoPath: "(root)", artifact: { type: "plugin" } })).toBe(
      "/s/o/r/.claude-plugin/plugin.json",
    );
  });
});

describe("renderRepoSummaryHtml — plugin rows use the manifest deep link", () => {
  it("emits the manifest-file href for a plugin row, not the plugin root", () => {
    const scan = {
      ref: "main",
      treeSha: "abc",
      truncated: false,
      errors: [],
      skills: [
        {
          repoPath: "my-plugin",
          name: "my-plugin",
          artifact: { type: "plugin" },
          scorecard: { overall: 90, grade: "A" },
        },
      ],
    } as unknown as RepoScanResult;
    const html = renderRepoSummaryHtml(scan, t);
    expect(html).toContain('href="/s/o/r/my-plugin/.claude-plugin/plugin.json"');
    expect(html).not.toContain('href="/s/o/r/my-plugin"');
  });
});

describe("renderRepoSummaryHtml — Embed this badge section (repo-summary demand loop)", () => {
  const scan = {
    ref: "main",
    treeSha: "abc",
    truncated: false,
    errors: [],
    skills: [
      { repoPath: "a", name: "a", artifact: { type: "skill" }, scorecard: { overall: 90, grade: "A" } },
      { repoPath: "b", name: "b", artifact: { type: "skill" }, scorecard: { overall: 80, grade: "B" } },
    ],
  } as unknown as RepoScanResult;

  it("omits the embed section when no embed option is passed", () => {
    const html = renderRepoSummaryHtml(scan, t);
    expect(html).not.toContain("Embed this badge");
    expect(html).not.toContain('class="copy-btn"');
    expect(html).not.toContain("navigator.clipboard");
  });

  it("renders the badge image, the exact badgeMarkdownLine() output, and the init hint when embed is passed", () => {
    const embed = { badgeUrl: "https://skillcrossroads.com/api/badge/o/r.svg", scorecardUrl: "https://skillcrossroads.com/s/o/r" };
    const html = renderRepoSummaryHtml(scan, t, { embed });
    expect(html).toContain("Embed this badge");
    expect(html).toContain(`src="${embed.badgeUrl}"`);
    expect(html).toContain(`href="${embed.scorecardUrl}"`);
    expect(html).toContain(
      `[![Skill Crossroads](${embed.badgeUrl})](${embed.scorecardUrl})`,
    );
    expect(html).toContain("npx skillcrossroads init");
  });

  it("renders the one-click copy button and clipboard script when embed is passed", () => {
    const embed = { badgeUrl: "https://skillcrossroads.com/api/badge/o/r.svg", scorecardUrl: "https://skillcrossroads.com/s/o/r" };
    const html = renderRepoSummaryHtml(scan, t, { embed });
    expect(html).toContain('class="embed-copy"');
    expect(html).toContain('<button type="button" class="copy-btn">Copy</button>');
    expect(html).toContain("navigator.clipboard");
    // The <pre> stays selectable/progressive-enhancement — the script only wires the button.
    expect(html).toContain('<pre class="embed-code">');
  });

  it("escapes a hostile badge/scorecard URL rather than reflecting it raw", () => {
    const embed = {
      badgeUrl: 'https://skillcrossroads.com/api/badge/o/r.svg" onerror="alert(1)',
      scorecardUrl: "https://skillcrossroads.com/s/o/r",
    };
    const html = renderRepoSummaryHtml(scan, t, { embed });
    expect(html).not.toContain('onerror="alert(1)"');
  });
});
