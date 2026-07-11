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

  it("renders suggested fixes escaped (suggestions derive from untrusted model output)", () => {
    const { scorecard } = audit(fixture("dangling-ref"));
    const html = renderHtml(scorecard, {
      name: "x",
      suggestions: [
        {
          checkId: "STRUCT-05",
          summary: "Remove the <script> reference",
          current: "<script>alert(1)</script>",
          proposed: "</pre><img src=x onerror=alert(2)>",
        },
        { checkId: "TOKEN-01", summary: "split it up", steps: ["do <b>this</b> first", "then that"] },
      ],
    });
    expect(html).toContain("Suggested fixes");
    // Check ids link to their docs pages, same as top fixes.
    expect(html).toContain("/docs/checks/struct-05");
    // Every dynamic value is escaped — nothing from the model lands as live markup.
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("do &lt;b&gt;this&lt;/b&gt; first");
    expect(html).toContain("then that");
  });

  it("renders no suggestions section when none are supplied", () => {
    const { scorecard } = audit(fixture("dangling-ref"));
    expect(renderHtml(scorecard, { name: "x" })).not.toContain("Suggested fixes");
    expect(renderHtml(scorecard, { name: "x", suggestions: [] })).not.toContain("Suggested fixes");
  });
});
