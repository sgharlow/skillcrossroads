import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/render/markdown.js";
import { gradeRank, meetsMinGrade } from "../src/score.js";
import { scanLocalDir, findLocalSkillDirs, audit } from "../src/index.js";
import { fixture } from "./helpers.js";
import { join } from "node:path";

describe("renderMarkdown", () => {
  it("renders a grade header, category table, and top fixes", () => {
    const { scorecard, name } = audit(fixture("dangling-ref"));
    const md = renderMarkdown(scorecard, { name });
    expect(md).toMatch(/^### .*Skill Crossroads: A —/m); // v1.1: dangling-ref grades A (was A−)
    expect(md).toContain("| Category | Score | |");
    expect(md).toContain("**Top fixes**");
    expect(md).toContain("**STRUCT-05**");
    expect(md).toContain("`SKILL.md:10`");
  });
  it("shows a clean-scan line when nothing fails", () => {
    const { scorecard } = audit(fixture("good-skill"));
    expect(renderMarkdown(scorecard)).toContain("Clean scan");
  });
});

describe("gradeRank / meetsMinGrade", () => {
  it("ranks grades best-first", () => {
    expect(gradeRank("A+")).toBeLessThan(gradeRank("A−"));
    expect(gradeRank("A−")).toBeLessThan(gradeRank("B+"));
    expect(gradeRank("F")).toBeGreaterThan(gradeRank("D−"));
  });
  it("gates correctly", () => {
    expect(meetsMinGrade("A+", "B")).toBe(true);
    expect(meetsMinGrade("B", "B")).toBe(true);
    expect(meetsMinGrade("C+", "B")).toBe(false);
    expect(meetsMinGrade("F", "C")).toBe(false);
  });
  it("accepts an ASCII hyphen for minus grades", () => {
    expect(meetsMinGrade("A−", "A-")).toBe(true);
    expect(meetsMinGrade("B+", "A-")).toBe(false);
  });
  it("does not gate on an unknown threshold", () => {
    expect(meetsMinGrade("F", "banana")).toBe(true);
  });
});

describe("scanLocalDir / findLocalSkillDirs", () => {
  const skillsRoot = join(fixture("good-skill"), "..");

  it("finds every skill dir under a folder", () => {
    const dirs = findLocalSkillDirs(skillsRoot);
    expect(dirs.length).toBeGreaterThanOrEqual(5); // good-skill, dangling-ref, has-secrets, no-frontmatter, vulnerable
  });

  it("scans a single skill dir as one result", async () => {
    const { skills } = await scanLocalDir(fixture("good-skill"));
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("meeting-notes");
  });

  it("scans a folder of skills as a batch, tagged by relative path", async () => {
    const { skills } = await scanLocalDir(skillsRoot);
    expect(skills.length).toBeGreaterThanOrEqual(5);
    expect(skills.map((s) => s.repoPath)).toContain("good-skill");
  });
});
