import { describe, it, expect } from "vitest";
import { createMemoryBadgeServes } from "../lib/badge-serves";

describe("badge-serves — badges-in-the-wild instrumentation", () => {
  it("counts distinct repos served to GitHub's camo proxy, not raw hits", async () => {
    const s = createMemoryBadgeServes();
    await s.record("o/r1", "github-camo (https://github.com/...)");
    await s.record("o/r1", "github-camo (https://github.com/...)"); // same repo twice
    await s.record("o/r2", "GitHub-Camo/2.0"); // case-insensitive
    await s.record("o/r3", "Mozilla/5.0"); // a browser hit is a serve, not a badge-on-GitHub
    await s.record("o/r4", null); // no UA at all
    const stats = await s.stats();
    expect(stats.reposOnGitHub).toBe(2);
    expect(stats.totalServes).toBe(5);
    expect(stats.windowDays).toBe(30);
  });

  it("starts empty", async () => {
    const stats = await createMemoryBadgeServes().stats(7);
    expect(stats).toEqual({ reposOnGitHub: 0, totalServes: 0, windowDays: 7 });
  });
});
