import type { CategoryScore } from "../types.js";

/**
 * Shared hex palette for the visual (HTML / SVG) renderers — the "harbor marker light" scheme.
 * Terminal rendering uses picocolors separately; these are for file output.
 */
export const PALETTE = {
  ink: "#0B1220",
  ink2: "#121D2F",
  ink3: "#1B2A42",
  fog: "#8CA0BF",
  foam: "#E8EEF7",
  beam: "#FFC24B",
  pass: "#35D0A5",
  warn: "#F5B44A",
  fail: "#FF6B6B",
} as const;

/** Grade band → color. A aqua-green, B cyan, C amber, D/F coral. */
export function gradeHex(grade: string): string {
  if (grade.startsWith("A")) return PALETTE.pass;
  if (grade.startsWith("B")) return "#4FB8FF";
  if (grade.startsWith("C")) return PALETTE.warn;
  return PALETTE.fail;
}

/** A category's summary color, driven by its worst result. */
export function statusHex(cat: CategoryScore): string {
  if (cat.failCount > 0) return PALETTE.fail;
  if (cat.warnCount > 0) return PALETTE.warn;
  return PALETTE.pass;
}
