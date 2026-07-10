import { describe, it, expect } from "vitest";
import { publicSkillPercentile, percentileLabel, STATE_OF_SKILLS } from "../src/percentile.js";

describe("publicSkillPercentile (State of Skills CDF)", () => {
  it("pins to the published 214-skill distribution", () => {
    expect(STATE_OF_SKILLS.n).toBe(214);
    expect(STATE_OF_SKILLS.buckets.reduce((a, b) => a + b.count, 0)).toBe(214);
  });

  it("is 0 at the floor and caps at 99 at the ceiling (can't beat a sample you belong to)", () => {
    expect(publicSkillPercentile(0)).toBe(0);
    expect(publicSkillPercentile(100)).toBe(99);
  });

  it("is monotonically non-decreasing", () => {
    let prev = -1;
    for (let s = 0; s <= 100; s++) {
      const p = publicSkillPercentile(s);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it("places the published average (73.6) near the middle of the sample", () => {
    const p = publicSkillPercentile(73.6);
    expect(p).toBeGreaterThan(40);
    expect(p).toBeLessThan(60);
  });

  it("interpolates within a band: 78 beats all F+D plus 80% of the C band", () => {
    // below = 11 + 52 + 113 * (78-70)/10 = 153.4 → 153.4/214 ≈ 72%
    expect(publicSkillPercentile(78)).toBe(72);
  });

  it("labels with the ≈ estimate marker and the pinned edition", () => {
    const label = percentileLabel(90);
    expect(label).toContain("≈");
    expect(label).toContain("214 public skills");
    expect(label).toContain(STATE_OF_SKILLS.edition);
  });

  it("clamps out-of-range scores instead of extrapolating", () => {
    expect(publicSkillPercentile(-5)).toBe(0);
    expect(publicSkillPercentile(140)).toBe(99);
  });
});
