import { describe, it, expect } from "vitest";
import { formatDemandReadout } from "../src/demand/format.js";
import type { DemandMetric } from "../src/demand/metric.js";
import type { G0Verdict } from "../src/demand/g0-gate.js";

const metric: DemandMetric = {
  externalScansTotal: 7, externalScansSinceLaunch: 3, attributedExternalLogins: 2,
  anonymousScans: 4, distinctExternalRepos: 5, dailyExternalTrend: [{ day: "2026-07-15", count: 2 }],
  badgeServesInWindow: 9, distinctBadgeReposFromGitHub: 6, galleryOptIns: 8, paidSubscriptions: 1,
};
const verdict: G0Verdict = { status: "live-signal", reasons: ["3 external scan(s) since 2026-07-13."] };

describe("formatDemandReadout", () => {
  it("renders the verdict, its reasons, and the key numbers", () => {
    const out = formatDemandReadout(metric, verdict);
    expect(out).toContain("LIVE SIGNAL");
    expect(out).toContain("3 external scan(s) since 2026-07-13.");
    expect(out).toContain("external scans (since launch): 3");
    expect(out).toContain("distinct external logins  : 2");
    expect(out).toContain("anonymous scans           : 4");
    expect(out).toContain("badge repos via GitHub    : 6");
    expect(out).toContain("paid subscriptions        : 1");
    expect(out).toContain("2026-07-15");
  });
});
