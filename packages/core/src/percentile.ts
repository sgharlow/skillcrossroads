/**
 * Ecosystem percentile — "your score beats ≈N% of publicly published skills".
 *
 * Derived from a pinned grade distribution, NOT raw per-skill scores, so the figure is an
 * interpolated ESTIMATE and is always rendered with a "≈" (honesty rule: never present a
 * derived figure as exact).
 *
 * COMPARABILITY RULE (the one that matters): the sample must be graded under the SAME rubric
 * and edition as the scan being ranked. A rubric bump that adds checks shifts live scores
 * relative to a stale sample and silently inflates the percentile — this happened when v1.2
 * keyless scores were ranked against the v1.0 LLM sample (a mediocre skill showed "≈99%").
 * The sample below is therefore the DETERMINISTIC current-rubric distribution, regenerated
 * with `scripts/percentile-sample.mjs` after EVERY rubric bump (the label carries the sample's
 * rubric so drift is visible, and a test pins the sample rubric to RUBRIC_VERSION). Keyed
 * (LLM-edition) scans are ranked against the same deterministic sample; LLM checks tend to
 * lower scores, so any residual bias UNDERSTATES rather than flatters.
 *
 * The published State-of-Skills REPORT is a separate pinned artifact (v1.0 LLM edition, its
 * own date stamp) — it is deliberately NOT this sample.
 *
 * Renderers only show the percentile for full (non-partial) SKILL scorecards.
 */
import { RUBRIC_VERSION } from "./types.js";

export interface PercentileSample {
  /** Rubric the sample was graded under — compared against RUBRIC_VERSION by a pinning test. */
  readonly rubric: string;
  /** Sample month, shown in the label. */
  readonly edition: string;
  readonly n: number;
  /** Grade-band buckets, ascending by score range: [minScore, maxScore) except the top band. */
  readonly buckets: readonly { readonly min: number; readonly max: number; readonly count: number }[];
}

/**
 * Deterministic rubric v1.2 sample — generated 2026-07-11 by scripts/percentile-sample.mjs
 * over the same 18 curated repos as the State-of-Skills report (0 repo failures, n=214).
 */
export const STATE_OF_SKILLS: PercentileSample = {
  rubric: "1.2",
  edition: "2026-07",
  n: 214,
  buckets: [
    { min: 0, max: 60, count: 0 }, // F
    { min: 60, max: 70, count: 6 }, // D
    { min: 70, max: 80, count: 2 }, // C
    { min: 80, max: 90, count: 38 }, // B
    { min: 90, max: 100, count: 168 }, // A
  ],
};

/** The sample must always match the live rubric — regenerate on every bump (pinned by test). */
export function sampleMatchesRubric(sample: PercentileSample = STATE_OF_SKILLS): boolean {
  return sample.rubric === RUBRIC_VERSION;
}

/**
 * Share of the sample scoring BELOW `overall`, as a 0–99 integer percentage. Linear
 * interpolation inside a grade band (scores within a band are treated as uniformly spread —
 * the sample stores band counts, not raw scores). Capped at 99: a skill can never claim to
 * outscore 100% of a sample it would itself belong to.
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
  return `scores higher than ≈${publicSkillPercentile(overall, sample)}% of ${sample.n} public skills (deterministic rubric v${sample.rubric} sample, ${sample.edition})`;
}
