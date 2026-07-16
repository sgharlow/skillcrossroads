import type { DemandMetric } from "./metric.js";

export type G0Status = "pre-launch" | "live-signal" | "pivot-warning" | "pivot";

export interface G0Verdict {
  status: G0Status;
  reasons: string[];
}

export interface G0Context {
  launchDate: string | null;
  launchPosts: number;
  now: Date;
}

const PIVOT_WEEKS = 4;
const PIVOT_MIN_POSTS = 2;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Encode the ROADMAP G0 gate: launch ⇒ external scans>0 (pass); 2 posts + 4 weeks + zero ⇒ pivot. */
export function evaluateG0(metric: DemandMetric, ctx: G0Context): G0Verdict {
  if (!ctx.launchDate) {
    return { status: "pre-launch", reasons: ["No LAUNCH_DATE set — gate not yet active."] };
  }
  if (metric.externalScansSinceLaunch > 0) {
    return {
      status: "live-signal",
      reasons: [`${metric.externalScansSinceLaunch} external scan(s) since ${ctx.launchDate}.`],
    };
  }
  const weeks = (ctx.now.getTime() - new Date(ctx.launchDate + "T00:00:00Z").getTime()) / WEEK_MS;
  if (ctx.launchPosts >= PIVOT_MIN_POSTS && weeks >= PIVOT_WEEKS) {
    return {
      status: "pivot",
      reasons: [
        `Zero external scans after ${ctx.launchPosts} launch post(s) and ${weeks.toFixed(1)} weeks.`,
        "ROADMAP threshold met — stop feature work, pivot.",
      ],
    };
  }
  const weeksLeft = Math.max(0, PIVOT_WEEKS - weeks);
  const postsLeft = Math.max(0, PIVOT_MIN_POSTS - ctx.launchPosts);
  return {
    status: "pivot-warning",
    reasons: [
      "Launched but zero external scans so far.",
      `Pivot triggers in ${weeksLeft.toFixed(1)} more week(s)` +
        (postsLeft > 0 ? ` and ${postsLeft} more launch post(s).` : "."),
    ],
  };
}
