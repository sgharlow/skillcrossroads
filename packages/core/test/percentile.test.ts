import { describe, it, expect } from "vitest";
import { publicSkillPercentile, percentileBadgeText, percentileLabel, STATE_OF_SKILLS, sampleMatchesRubric } from "../src/percentile.js";

describe("publicSkillPercentile (State of Skills CDF)", () => {
  it("pins to the regenerated 214-skill distribution", () => {
    expect(STATE_OF_SKILLS.n).toBe(214);
    expect(STATE_OF_SKILLS.buckets.reduce((a, b) => a + b.count, 0)).toBe(214);
  });

  it("the sample rubric matches the LIVE rubric — regenerate via scripts/percentile-sample.mjs on every bump", () => {
    // This is the comparability guard: a stale sample silently inflates (or deflates) every
    // percentile on every scorecard. If this fails, run the sample script and paste the block.
    expect(sampleMatchesRubric(), "STATE_OF_SKILLS.rubric must equal RUBRIC_VERSION").toBe(true);
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

  it("reflects the v1.2 deterministic reality: most public skills grade A, so an A is unremarkable", () => {
    // 168/214 of the sample are A-band — a 92 no longer claims "≈99%".
    expect(publicSkillPercentile(92)).toBeLessThan(40);
    expect(publicSkillPercentile(97)).toBeGreaterThan(60);
  });

  it("interpolates within a band: 85 beats F+D+C plus half the B band", () => {
    // below = 0 + 6 + 2 + 38 * (85-80)/10 = 27 → 27/214 ≈ 13%
    expect(publicSkillPercentile(85)).toBe(13);
  });

  it("labels with the ≈ marker, the pinned edition, AND the sample rubric (drift stays visible)", () => {
    const label = percentileLabel(90);
    expect(label).toContain("≈");
    expect(label).toContain("214 public skills");
    expect(label).toContain(STATE_OF_SKILLS.edition);
    expect(label).toContain(`deterministic rubric v${STATE_OF_SKILLS.rubric} sample`);
  });

  it("clamps out-of-range scores instead of extrapolating", () => {
    expect(publicSkillPercentile(-5)).toBe(0);
    expect(publicSkillPercentile(140)).toBe(99);
  });
});

describe("percentileBadgeText", () => {
  it("renders ≈top N% as the complement of the beats-percentile, with the honesty ≈", () => {
    const t = percentileBadgeText(90);
    expect(t).toMatch(/^≈top \d+%$/);
    expect(t).toBe(`≈top ${100 - publicSkillPercentile(90)}%`);
  });
  it("is monotonic — a higher score is never a larger top-percent", () => {
    const hi = Number(percentileBadgeText(98).match(/(\d+)/)![1]);
    const lo = Number(percentileBadgeText(55).match(/(\d+)/)![1]);
    expect(hi).toBeLessThanOrEqual(lo);
  });
});
