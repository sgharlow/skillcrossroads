import { describe, it, expect } from "vitest";
import { renderBadge } from "../src/render/badge.js";
import type { Scorecard } from "../src/types.js";

function card(grade: string): Scorecard {
  return {
    rubricVersion: "1.0",
    overall: 90,
    grade,
    categories: [],
    results: [],
    partial: true,
  };
}

describe("renderBadge", () => {
  it("produces a valid, self-contained SVG", () => {
    const svg = renderBadge(card("A−"));
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain("A−");
    expect(svg).toContain("skill crossroads");
    // no external references
    expect(svg).not.toMatch(/href=|<image|url\(http/);
  });

  it("has a positive computed width", () => {
    const svg = renderBadge(card("B+"));
    const w = Number(svg.match(/width="(\d+)"/)?.[1]);
    expect(w).toBeGreaterThan(20);
  });

  it("colors the value by grade band", () => {
    const a = renderBadge(card("A"));
    const f = renderBadge(card("F"));
    expect(a).toContain("#35D0A5"); // A → aqua-green
    expect(f).toContain("#FF6B6B"); // F → coral
    expect(a).not.toContain("#FF6B6B");
  });

  it("allows a custom label and value and escapes them", () => {
    const svg = renderBadge(card("A"), { label: "quality <x>", value: "top & best" });
    expect(svg).toContain("quality &lt;x&gt;");
    expect(svg).toContain("top &amp; best");
    expect(svg).not.toContain("<x>");
  });
});
