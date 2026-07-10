import { describe, it, expect } from "vitest";
import { renderHtml } from "../src/render/html.js";
import { renderBadge } from "../src/render/badge.js";
import type { Scorecard } from "../src/types.js";

function card(grade: string, partial: boolean): Scorecard {
  return { rubricVersion: "1.0", overall: 90, grade, categories: [], results: [], partial };
}

describe("demand-loop closers in renderHtml", () => {
  it("has no CTA/links without homeUrl (CLI self-contained default)", () => {
    const html = renderHtml(card("A", false), { name: "x" });
    expect(html).not.toContain("Scan your own skill");
    expect(html).not.toContain("<img"); // no external asset requests
  });

  it("adds a 'Scan your own skill' CTA and home link when homeUrl is set", () => {
    const html = renderHtml(card("A", false), { name: "x", homeUrl: "/" });
    expect(html).toContain("Scan your own skill");
    expect(html).toContain('href="/"');
  });

  it("renders a copy-paste linked-badge embed snippet when embed is set", () => {
    const html = renderHtml(card("A", false), {
      name: "x",
      homeUrl: "/",
      embed: { badgeUrl: "https://skillcrossroads.com/api/badge/o/r.svg", scorecardUrl: "https://skillcrossroads.com/s/o/r" },
    });
    expect(html).toContain("[![Skill Crossroads](https://skillcrossroads.com/api/badge/o/r.svg)](https://skillcrossroads.com/s/o/r)");
  });

  it("escapes URLs passed into the embed/CTA (defense-in-depth)", () => {
    const html = renderHtml(card("A", false), { name: "x", homeUrl: `"/><script>alert(1)</script>` });
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("badge discloses a partial grade", () => {
  it("marks a partial (keyless) grade with a trailing *", () => {
    expect(renderBadge(card("A+", true))).toContain("A+*");
  });
  it("shows a clean grade when fully evaluated", () => {
    const svg = renderBadge(card("A+", false));
    expect(svg).toContain("A+");
    expect(svg).not.toContain("A+*");
  });
});
