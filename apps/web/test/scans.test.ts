import { describe, it, expect } from "vitest";
import { createMemoryScanHistory } from "../lib/scans";
import { trendChartSvg } from "../lib/chart";
import { slugFor } from "../lib/record";

describe("scan history store", () => {
  it("records and returns chronological history for a slug", async () => {
    const h = createMemoryScanHistory();
    await h.record({ slug: "a/r/one", name: "one", grade: "B", overall: 84, rubricVersion: "1.0" });
    await h.record({ slug: "a/r/one", name: "one", grade: "A", overall: 95, rubricVersion: "1.0" });
    await h.record({ slug: "a/r/two", name: "two", grade: "C", overall: 72, rubricVersion: "1.0" });
    const hist = await h.history("a/r/one");
    expect(hist.map((p) => p.overall)).toEqual([84, 95]); // oldest → newest
  });

  it("returns recent scans newest-first across slugs", async () => {
    const h = createMemoryScanHistory();
    await h.record({ slug: "a/r/one", name: "one", grade: "B", overall: 84, rubricVersion: "1.0" });
    await h.record({ slug: "a/r/two", name: "two", grade: "C", overall: 72, rubricVersion: "1.0" });
    const recent = await h.recent(10);
    expect(recent.map((r) => r.name)).toEqual(["two", "one"]);
  });

  it("computes stats from each skill's latest grade", async () => {
    const h = createMemoryScanHistory();
    await h.record({ slug: "a/r/one", name: "one", grade: "B", overall: 84, rubricVersion: "1.0" });
    await h.record({ slug: "a/r/one", name: "one", grade: "A", overall: 95, rubricVersion: "1.0" }); // latest A
    await h.record({ slug: "a/r/two", name: "two", grade: "A", overall: 96, rubricVersion: "1.0" });
    const s = await h.stats();
    expect(s.totalScans).toBe(3);
    expect(s.distinctSkills).toBe(2);
    expect(s.byGrade).toEqual({ A: 2 }); // both skills currently A (one/latest + two)
  });
});

describe("slugFor", () => {
  it("joins owner/repo/path and drops (root)", () => {
    expect(slugFor("a", "r", "skills/x")).toBe("a/r/skills/x");
    expect(slugFor("a", "r", "(root)")).toBe("a/r");
  });
});

describe("trendChartSvg", () => {
  const pts = [
    { grade: "B", overall: 84, scannedAt: "2026-06-01T00:00:00Z" },
    { grade: "A−", overall: 90, scannedAt: "2026-06-15T00:00:00Z" },
    { grade: "A", overall: 95, scannedAt: "2026-07-01T00:00:00Z" },
  ];
  it("renders a polyline + dots for multiple points", () => {
    const svg = trendChartSvg(pts);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<polyline");
    expect((svg.match(/<circle/g) ?? []).length).toBe(3);
    expect(svg).toContain("2026-06-01");
    expect(svg).toContain("2026-07-01");
  });
  it("handles a single point (no polyline)", () => {
    const svg = trendChartSvg([pts[0]!]);
    expect(svg).not.toContain("<polyline");
    expect(svg).toContain("<circle");
  });
  it("returns empty string for no points", () => {
    expect(trendChartSvg([])).toBe("");
  });
});
