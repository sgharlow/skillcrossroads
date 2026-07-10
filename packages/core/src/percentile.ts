/**
 * Ecosystem percentile — "your score beats ≈N% of publicly published skills".
 *
 * Derived from the published "State of Claude Code Skills" grade distribution (LLM edition), NOT
 * from raw per-skill scores, so the figure is an interpolated ESTIMATE and is always rendered
 * with a "≈" (honesty rule: never present a derived figure as exact). The distribution is pinned
 * per report edition; regenerating the report is the only way this table changes.
 *
 * Comparability rule: the sample is full-rubric (all six categories scored), so callers must only
 * show a percentile for full (non-partial) scorecards — a deterministic-only partial grade
 * against a full-rubric sample would overstate. Renderers enforce this. Note: the pinned sample
 * was graded under rubric v1.0 (LLM edition); v1.1 grades are compared against it as an estimate
 * (the ≈) until the next report edition regenerates the distribution.
 */

export interface PercentileSample {
  /** Report edition the distribution is pinned to (shown in the label). */
  readonly edition: string;
  readonly n: number;
  /** Grade-band buckets, ascending by score range: [minScore, maxScore) except the top band. */
  readonly buckets: readonly { readonly min: number; readonly max: number; readonly count: number }[];
}

/** Pinned distribution from reports/state-of-claude-code-skills.md (LLM edition, 214 skills). */
export const STATE_OF_SKILLS: PercentileSample = {
  edition: "2026-07",
  n: 214,
  buckets: [
    { min: 0, max: 60, count: 11 }, // F
    { min: 60, max: 70, count: 52 }, // D
    { min: 70, max: 80, count: 113 }, // C
    { min: 80, max: 90, count: 37 }, // B
    { min: 90, max: 100, count: 1 }, // A
  ],
};

/**
 * Share of the sample scoring BELOW `overall`, as a 0–99 integer percentage. Linear
 * interpolation inside a grade band (scores within a band are treated as uniformly spread —
 * the source report publishes band counts, not raw scores). Capped at 99: a skill can never
 * claim to outscore 100% of a sample it would itself belong to.
 */
export function publicSkillPercentile(overall: number, sample: PercentileSample = STATE_OF_SKILLS): number {
  const s = Math.max(0, Math.min(100, overall));
  let below = 0;
  for (const b of sample.buckets) {
    if (s >= b.max) below += b.count;
    else if (s > b.min) below += (b.count * (s - b.min)) / (b.max - b.min);
  }
  return Math.min(99, Math.round((below / sample.n) * 100));
}

/** The standard one-line label, pre-formatted so every surface says exactly the same thing. */
export function percentileLabel(overall: number, sample: PercentileSample = STATE_OF_SKILLS): string {
  return `scores higher than ≈${publicSkillPercentile(overall, sample)}% of ${sample.n} public skills (State of Skills, ${sample.edition})`;
}
