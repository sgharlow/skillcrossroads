import { describe, it, expect } from "vitest";
import { renderHtml } from "../src/render/html.js";
import { audit } from "../src/index.js";
import { score } from "../src/score.js";
import { fixture } from "./helpers.js";
import type { CheckResult } from "../src/types.js";

describe("renderHtml", () => {
  it("renders a self-contained document with the grade and categories", () => {
    const { scorecard, name } = audit(fixture("good-skill"));
    const html = renderHtml(scorecard, { name, scannedAt: "2026-07-08" });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Skill Crossroads — meeting-notes</title>");
    expect(html).toContain(scorecard.grade);
    expect(html).toContain("Correctness &amp; Structure");
    expect(html).not.toContain("not yet scored"); // v1.1: all six categories score for skills
    expect(html).toContain("scanned 2026-07-08");
  });

  it("makes no external requests (fully offline / self-contained)", () => {
    const { scorecard } = audit(fixture("good-skill"));
    const html = renderHtml(scorecard);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/url\(\s*https?:/i);
    expect(html).not.toMatch(/src=["']https?:/i);
  });

  it("lists prioritized fixes with evidence for a failing skill", () => {
    const { scorecard, name } = audit(fixture("dangling-ref"));
    const html = renderHtml(scorecard, { name });
    expect(html).toContain("Top fixes");
    expect(html).toContain("STRUCT-05");
    expect(html).toContain("SKILL.md:10");
  });

  it("shows a clean-scan state when nothing fails", () => {
    const { scorecard } = audit(fixture("good-skill"));
    expect(renderHtml(scorecard)).toContain("Clean scan");
  });

  it("escapes HTML in evidence to prevent injection", () => {
    const results: CheckResult[] = [
      {
        id: "SAFETY-01",
        category: "safety",
        title: "No hardcoded secrets",
        weight: 1,
        status: "fail",
        score: 0,
        evidence: [
          { file: "SKILL.md", line: 3, message: "danger", snippet: "<script>alert(1)</script>" },
        ],
        fix: "remove <it>",
      },
    ];
    const html = renderHtml(score(results), { name: "x" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
