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
