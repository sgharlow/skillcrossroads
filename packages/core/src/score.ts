import {
  CATEGORIES,
  RUBRIC_VERSION,
  type Category,
  type CategoryScore,
  type CheckResult,
  type Scorecard,
} from "./types.js";

/** Standard +/- letter-grade bands over a 0–100 score. */
export function letterGrade(score: number): string {
  const s = Math.round(score);
  if (s >= 97) return "A+";
  if (s >= 93) return "A";
  if (s >= 90) return "A−";
  if (s >= 87) return "B+";
  if (s >= 83) return "B";
  if (s >= 80) return "B−";
  if (s >= 77) return "C+";
  if (s >= 73) return "C";
  if (s >= 70) return "C−";
  if (s >= 67) return "D+";
  if (s >= 63) return "D";
  if (s >= 60) return "D−";
  return "F";
}

/** Weighted average of a category's check scores (by each check's `weight`). */
function categoryScore(results: CheckResult[]): number {
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = results.reduce((sum, r) => sum + r.score * r.weight, 0);
  return weighted / totalWeight;
}

/**
 * Roll check results up into a graded Scorecard.
 *
 * Overall is computed over **evaluated categories only**, with the rubric weights renormalized
 * across them. Categories with no checks are reported as `evaluated: false` / `score: null` and
 * excluded from the overall — an honest partial grade, never a faked zero or a full 100.
 */
export function score(results: readonly CheckResult[]): Scorecard {
  const byCategory = new Map<Category, CheckResult[]>();
  for (const r of results) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  const categories: CategoryScore[] = CATEGORIES.map((meta) => {
    const list = byCategory.get(meta.key) ?? [];
    const evaluated = list.length > 0;
    return {
      key: meta.key,
      label: meta.label,
      weight: meta.weight,
      evaluated,
      score: evaluated ? categoryScore(list) : null,
      results: list,
      warnCount: list.filter((r) => r.status === "warn").length,
      failCount: list.filter((r) => r.status === "fail").length,
    };
  });

  const evaluated = categories.filter((c) => c.evaluated);
  const weightSum = evaluated.reduce((sum, c) => sum + c.weight, 0);
  const overall =
    weightSum === 0
      ? 0
      : evaluated.reduce((sum, c) => sum + (c.score as number) * (c.weight / weightSum), 0);

  return {
    rubricVersion: RUBRIC_VERSION,
    overall: Math.round(overall * 10) / 10,
    grade: letterGrade(overall),
    categories,
    results: [...results],
    partial: evaluated.length < CATEGORIES.length,
  };
}
