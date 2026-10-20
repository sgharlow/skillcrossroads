import { describe, it, expect } from "vitest";
import { evaluateG0 } from "../src/demand/g0-gate.js";
import type { DemandMetric } from "../src/demand/metric.js";

const base: DemandMetric = {
  externalScansTotal: 0, externalScansSinceLaunch: 0, attributedExternalScansSinceLaunch: 0,
  unattributedScans: 0, attributedExternalLogins: 0,
  anonymousScans: 0, distinctExternalRepos: 0, dailyExternalTrend: [],
  badgeServesInWindow: 0, distinctBadgeReposFromGitHub: 0, galleryOptIns: 0, paidSubscriptions: 0,
  externalScansBySource: [], reposWithBadgeServe: 0, reposWithGalleryOptIn: 0,
};

describe("evaluateG0", () => {
  it("pre-launch when no launch date", () => {
    const v = evaluateG0(base, { launchDate: null, launchPosts: 0, now: new Date("2026-07-15T00:00:00Z") });
    expect(v.status).toBe("pre-launch");
  });
  // Corrected 2026-10-19: a referred scan is NOT a G0 pass arm (PROJECT.yaml G0-launch
  // `pass_arms`), and prod cannot tell a logged-out owner with an external referer from a
  // stranger. With the kill thresholds met it must not hold the pivot off.
  it("pivots past the kill thresholds even with referred scans (context, not a pass arm)", () => {
    const v = evaluateG0({ ...base, attributedExternalScansSinceLaunch: 734 },
      { launchDate: "2026-07-13", launchPosts: 3, now: new Date("2026-08-20T00:00:00Z") });
    expect(v.status).toBe("pivot");
  });
  it("pivot-warning when launched, zero scans, before the 4-week / 2-post threshold", () => {
    const v = evaluateG0(base,
      { launchDate: "2026-07-13", launchPosts: 1, now: new Date("2026-07-20T00:00:00Z") });
    expect(v.status).toBe("pivot-warning");
  });
  it("pivot when zero external scans after >=2 posts and >=4 weeks", () => {
    const v = evaluateG0(base,
      { launchDate: "2026-07-13", launchPosts: 2, now: new Date("2026-08-15T00:00:00Z") });
    expect(v.status).toBe("pivot");
  });
  it("stays pivot-warning at 4 weeks if fewer than 2 posts", () => {
    const v = evaluateG0(base,
      { launchDate: "2026-07-13", launchPosts: 1, now: new Date("2026-08-15T00:00:00Z") });
    expect(v.status).toBe("pivot-warning");
  });
  it("pivots at exactly 4.0 weeks with exactly 2 posts (>= boundary)", () => {
    const v = evaluateG0(base,
      { launchDate: "2026-07-13", launchPosts: 2, now: new Date("2026-08-10T00:00:00Z") });
    expect(v.status).toBe("pivot");
  });
});

/**
 * Regression tests for the 2026-09-09 prod audit.
 *
 * `evaluateG0` passed the gate on `externalScansSinceLaunch > 0`. In prod, `login` is NULL on
 * every one of 15,510 scan rows and `source` is NULL on 15,193 of them, so that counter counts
 * unattributed traffic — including the owner's own re-scans. Posting to HN would have flipped the
 * gate to `live-signal` within hours whether or not one stranger arrived.
 *
 * PROJECT.yaml ratifies a different, narrower condition: ">= 1 stranger-initiated scan (gallery
 * opt-in, external badge embed, or Action install) OR >= 25 /report readers with >= 3 site scans
 * OR >= 1 Team-tier inquiry" — listed once as G0-launch `pass_arms` and mirrored by G0_PASS_ARMS
 * (demand-g0-contract.test.ts). Only gallery + badge are measured by this metric; the rest make
 * the verdict "unknown", never "live-signal". These pin the gate to that condition.
 */
describe("evaluateG0 — only arms-length signal passes the gate", () => {
  const launched = { launchDate: "2026-09-15", launchPosts: 1, now: new Date("2026-09-16T00:00:00Z") };

  it("does not pass on unattributed scan volume alone", () => {
    const v = evaluateG0(
      { ...base, externalScansSinceLaunch: 15426, unattributedScans: 15193 } as any,
      launched,
    );
    expect(v.status).toBe("pivot-warning");
  });

  it("passes on an arms-length badge embed", () => {
    const v = evaluateG0({ ...base, distinctBadgeReposFromGitHub: 1 }, launched);
    expect(v.status).toBe("live-signal");
  });

  it("passes on an arms-length gallery opt-in", () => {
    const v = evaluateG0({ ...base, galleryOptIns: 1 }, launched);
    expect(v.status).toBe("live-signal");
  });

  // 2026-10-19: referred scans and paid subscriptions are not in the ratified pass list. The
  // 10-19 08:03 readout said LIVE SIGNAL on 734 referred scans alone (badge 0, gallery 0).
  it("does NOT pass on referred scans alone — the gate cannot say live-signal or zero", () => {
    const v = evaluateG0({ ...base, attributedExternalScansSinceLaunch: 734 }, launched);
    expect(v.status).not.toBe("live-signal");
    expect(v.status).toBe("unknown");
  });

  it("does NOT pass on a paid subscription alone", () => {
    const v = evaluateG0({ ...base, paidSubscriptions: 1 }, launched);
    expect(v.status).not.toBe("live-signal");
    expect(v.status).toBe("unknown");
  });

  it("is unknown when only unmeasured arms could carry it, and names those arms", () => {
    const v = evaluateG0(
      { ...base, attributedExternalScansSinceLaunch: 3, paidSubscriptions: 1 },
      launched,
    );
    expect(v.status).toBe("unknown");
    const text = v.reasons.join("\n");
    for (const arm of ["action_install", "report_readers_25x3", "team_inquiry"]) {
      expect(text).toContain(arm);
    }
  });

  it("still pivots past the kill thresholds when only context signals exist", () => {
    const v = evaluateG0(
      { ...base, attributedExternalScansSinceLaunch: 3, paidSubscriptions: 1 },
      { launchDate: "2026-09-15", launchPosts: 2, now: new Date("2026-10-19T00:00:00Z") },
    );
    expect(v.status).toBe("pivot");
  });

  it("a measured arm still passes even when context signals are present", () => {
    const v = evaluateG0(
      { ...base, galleryOptIns: 1, attributedExternalScansSinceLaunch: 3 },
      { launchDate: "2026-09-15", launchPosts: 2, now: new Date("2026-10-19T00:00:00Z") },
    );
    expect(v.status).toBe("live-signal");
  });
});

/**
 * LAUNCH_DATE gets set in Vercel ahead of the post so the send day is paste-and-go. A date that
 * has not arrived yet must NOT activate the gate: it would start the 4-week pivot clock early and
 * report "pivot triggers in N weeks" before anything had been posted.
 */
describe("evaluateG0 — a LAUNCH_DATE in the future is still pre-launch", () => {
  it("stays pre-launch when the launch date has not arrived", () => {
    const v = evaluateG0(base, {
      launchDate: "2026-09-15",
      launchPosts: 0,
      now: new Date("2026-09-10T00:00:00Z"),
    });
    expect(v.status).toBe("pre-launch");
  });

  it("activates on the launch date itself", () => {
    const v = evaluateG0(base, {
      launchDate: "2026-09-15",
      launchPosts: 1,
      now: new Date("2026-09-15T00:00:00Z"),
    });
    expect(v.status).toBe("pivot-warning");
  });
});
