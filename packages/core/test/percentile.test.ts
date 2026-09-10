import { describe, it, expect } from "vitest";
import {
  publicSkillPercentile,
  percentileBadgeText,
  percentileLabel,
  STATE_OF_SKILLS,
  sampleMatchesRubric,
  showsPercentile,
} from "../src/percentile.js";
import type { Scorecard } from "../src/types.js";

describe("publicSkillPercentile (State of Skills CDF)", () => {
  it("pins to the regenerated 208-skill distribution (2026-09 edition)", () => {
    expect(STATE_OF_SKILLS.n).toBe(208);
    expect(STATE_OF_SKILLS.buckets.reduce((a, b) => a + b.count, 0)).toBe(208);
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
    // 161/208 of the sample are A-band (2026-09 edition) — a 92 no longer claims "≈99%".
    expect(publicSkillPercentile(92)).toBeLessThan(40);
    expect(publicSkillPercentile(97)).toBeGreaterThan(60);
  });

  it("interpolates within a band: 85 beats F+D+C plus half the B band", () => {
    // below = 1 + 7 + 2 + 37 * (85-80)/10 = 28.5 → 28.5/208 ≈ 13.7% → 14 (2026-09 edition)
    expect(publicSkillPercentile(85)).toBe(14);
  });

  it("labels with the ≈ marker, the pinned edition, AND the sample rubric (drift stays visible)", () => {
    const label = percentileLabel(90);
    expect(label).toContain("≈");
    expect(label).toContain("208 public skills");
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

describe("showsPercentile", () => {
  const card = (over: Partial<Scorecard> = {}): Scorecard =>
    ({ rubricVersion: "1.2", overall: 90, grade: "A", categories: [], results: [], partial: false, kind: "skill", ...over }) as Scorecard;
  it("shows for a full skill card on a matching rubric", () => {
    expect(showsPercentile(card())).toBe(true);
  });
  it("hides for a non-skill artifact (would overstate vs the skills sample)", () => {
    expect(showsPercentile(card({ kind: "subagent" }))).toBe(false);
    expect(showsPercentile(card({ kind: "command" }))).toBe(false);
  });
  it("hides for a partial grade", () => {
    expect(showsPercentile(card({ partial: true }))).toBe(false);
  });
  it("defaults a missing kind to skill", () => {
    expect(showsPercentile(card({ kind: undefined }))).toBe(true);
  });
});
