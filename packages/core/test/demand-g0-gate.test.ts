import { describe, it, expect } from "vitest";
import { evaluateG0 } from "../src/demand/g0-gate.js";
import type { DemandMetric } from "../src/demand/metric.js";

const base: DemandMetric = {
  externalScansTotal: 0, externalScansSinceLaunch: 0, attributedExternalLogins: 0,
  anonymousScans: 0, distinctExternalRepos: 0, dailyExternalTrend: [],
  badgeServesInWindow: 0, distinctBadgeReposFromGitHub: 0, galleryOptIns: 0, paidSubscriptions: 0,
};

describe("evaluateG0", () => {
  it("pre-launch when no launch date", () => {
    const v = evaluateG0(base, { launchDate: null, launchPosts: 0, now: new Date("2026-07-15T00:00:00Z") });
    expect(v.status).toBe("pre-launch");
  });
  it("live-signal on the first external scan since launch", () => {
    const v = evaluateG0({ ...base, externalScansSinceLaunch: 1 },
      { launchDate: "2026-07-13", launchPosts: 3, now: new Date("2026-08-20T00:00:00Z") });
    expect(v.status).toBe("live-signal");
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
