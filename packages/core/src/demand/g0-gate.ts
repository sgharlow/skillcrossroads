import type { DemandMetric } from "./metric.js";

/**
 * The G0-launch pass arms, mirrored from PROJECT.yaml `gates[G0-launch].pass_arms` — that list is
 * the authoritative definition; demand-g0-contract.test.ts fails if the two ever differ. Referred
 * scans and paid subscriptions are NOT pass arms: the ratified target never named them.
 */
export const G0_PASS_ARMS = [
  "gallery_opt_in",
  "external_badge_embed",
  "action_install",
  "report_readers_25x3",
  "team_inquiry",
] as const;
export type G0PassArm = (typeof G0_PASS_ARMS)[number];

/** Pass arms this metric measures (owner-excluded, arms-length counts). */
export const G0_MEASURED_ARMS = ["gallery_opt_in", "external_badge_embed"] as const satisfies readonly G0PassArm[];
/** Pass arms nothing here measures — they must be read by hand; until then the gate cannot say "zero". */
export const G0_UNMEASURED_ARMS = [
  "action_install",
  "report_readers_25x3",
  "team_inquiry",
] as const satisfies readonly G0PassArm[];

export type G0Status = "pre-launch" | "live-signal" | "pivot-warning" | "pivot" | "unknown";

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

/**
 * Encode the G0-launch gate. Order: pre-launch → live-signal (a MEASURED pass arm > 0) → pivot
 * (kill thresholds met) → pivot-warning (nothing at all observed) → unknown (only context signals
 * observed; an unmeasured pass arm could still carry the gate, so it is neither passed nor zero).
 */
export function evaluateG0(metric: DemandMetric, ctx: G0Context): G0Verdict {
  if (!ctx.launchDate) {
    return { status: "pre-launch", reasons: ["No LAUNCH_DATE set — gate not yet active."] };
  }
  // LAUNCH_DATE is set in Vercel ahead of the post so send day is paste-and-go. Until that date
  // arrives the gate must stay dark: activating early starts the 4-week pivot clock against a
  // post that has not happened.
  if (new Date(ctx.launchDate + "T00:00:00Z").getTime() > ctx.now.getTime()) {
    return {
      status: "pre-launch",
      reasons: [`LAUNCH_DATE ${ctx.launchDate} has not arrived — gate not yet active.`],
    };
  }
  // PROJECT.yaml's ratified pass condition is a STRANGER-INITIATED signal, not scan volume.
  // Raw scan count cannot carry the gate: prod has no login on any scan row and no source on 98%
  // of them, so that counter also counts the owner's own re-scans (2026-09-09 audit).
  const passes: string[] = [];
  if (metric.distinctBadgeReposFromGitHub > 0)
    passes.push(`external_badge_embed: ${metric.distinctBadgeReposFromGitHub} arms-length badge embed(s).`);
  if (metric.galleryOptIns > 0)
    passes.push(`gallery_opt_in: ${metric.galleryOptIns} arms-length gallery opt-in(s).`);
  // Context only (2026-10-19): neither is a pass arm. A referred scan cannot be told apart from a
  // logged-out owner arriving via an external referer, and subscriptions were never in the ratified
  // pass list (owner-filtered by login since 2026-10-19, but still context).
  const context: string[] = [];
  if (metric.attributedExternalScansSinceLaunch > 0)
    context.push(
      `Context, not a pass arm: ${metric.attributedExternalScansSinceLaunch} referred scan(s) since ${ctx.launchDate}.`,
    );
  if (metric.paidSubscriptions > 0)
    context.push(`Context, not a pass arm: ${metric.paidSubscriptions} paid subscription(s).`);
  if (passes.length > 0) return { status: "live-signal", reasons: [...passes, ...context] };

  const unmeasured = `Not measured by this readout (check by hand): ${G0_UNMEASURED_ARMS.join(", ")}.`;
  // Parse-only (deterministic): "now" is the injected ctx.now, never a clock read.
  const weeks = (ctx.now.getTime() - new Date(ctx.launchDate + "T00:00:00Z").getTime()) / WEEK_MS;
  if (ctx.launchPosts >= PIVOT_MIN_POSTS && weeks >= PIVOT_WEEKS) {
    return {
      status: "pivot",
      reasons: [
        `Zero measured pass-arm signal after ${ctx.launchPosts} launch post(s) and ${weeks.toFixed(1)} weeks.`,
        "ROADMAP threshold met — stop feature work, pivot.",
        ...context,
        unmeasured,
      ],
    };
  }
  const weeksLeft = Math.max(0, PIVOT_WEEKS - weeks);
  const postsLeft = Math.max(0, PIVOT_MIN_POSTS - ctx.launchPosts);
  const pivotClock =
    `Pivot triggers in ${weeksLeft.toFixed(1)} more week(s)` +
    (postsLeft > 0 ? ` and ${postsLeft} more launch post(s).` : ".");
  if (context.length === 0) {
    return {
      status: "pivot-warning",
      reasons: ["Launched but zero external scans so far.", pivotClock, unmeasured],
    };
  }
  return {
    status: "unknown",
    reasons: ["No measured pass arm (gallery opt-in, external badge embed) has fired.", ...context, unmeasured, pivotClock],
  };
}
