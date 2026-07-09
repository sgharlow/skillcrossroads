import { describe, it, expect } from "vitest";
import { score, letterGrade, meetsMinGrade } from "../src/score.js";
import type { CheckResult, Category, CheckStatus } from "../src/types.js";

function result(
  id: string,
  category: Category,
  scoreVal: number,
  status: CheckStatus = scoreVal >= 100 ? "pass" : scoreVal <= 0 ? "fail" : "warn",
): CheckResult {
  return { id, category, title: id, weight: 1, status, score: scoreVal, evidence: [] };
}

describe("letterGrade", () => {
  it.each([
    [100, "A+"],
    [97, "A+"],
    [95, "A"],
    [92, "A−"],
    [90, "A−"],
    [88, "B+"],
    [70, "C−"],
    [60, "D−"],
    [59, "F"],
    [0, "F"],
  ])("maps %i → %s", (n, g) => {
    expect(letterGrade(n)).toBe(g);
  });

  it("bands apply to the value as-given, so a decimal grade matches the number shown (no rounding-up)", () => {
    expect(letterGrade(96.6)).toBe("A"); // NOT A+ — the card shows 96.6, so the grade must be A
    expect(letterGrade(89.9)).toBe("B+"); // NOT A− — bands are ≥90 for A−
    expect(letterGrade(97)).toBe("A+");
  });
});

describe("meetsMinGrade normalizes both sides", () => {
  it("treats an ASCII-hyphen grade the same as a minus grade", () => {
    expect(meetsMinGrade("A-", "A−")).toBe(true); // grade normalized, not just the threshold
    expect(meetsMinGrade("B-", "B")).toBe(false); // B− does not meet B
    expect(meetsMinGrade("A", "A-")).toBe(true);
  });
});

describe("score", () => {
  it("averages checks within a category", () => {
    const card = score([result("A", "correctness", 100), result("B", "correctness", 0)]);
    const corr = card.categories.find((c) => c.key === "correctness");
    expect(corr?.score).toBe(50);
    expect(corr?.failCount).toBe(1);
  });

  it("renormalizes the overall over evaluated categories only", () => {
    const card = score([
      result("A", "correctness", 100),
      result("B", "correctness", 0), // correctness = 50, weight .20
      result("T", "token", 100), //            token       = 100, weight .15
    ]);
    // (50*.20 + 100*.15) / (.35) = 71.43
    expect(card.overall).toBeCloseTo(71.4, 1);
    expect(card.grade).toBe("C−");
    expect(card.partial).toBe(true);
  });

  it("marks unevaluated categories as not-evaluated with a null score", () => {
    const card = score([result("A", "correctness", 100)]);
    const trig = card.categories.find((c) => c.key === "triggering");
    expect(trig?.evaluated).toBe(false);
    expect(trig?.score).toBeNull();
  });

  it("gives a perfect card an A+ overall", () => {
    const card = score([
      result("A", "correctness", 100),
      result("T", "token", 100),
      result("C", "clarity", 100),
      result("S", "safety", 100),
    ]);
    expect(card.overall).toBe(100);
    expect(card.grade).toBe("A+");
  });
});
