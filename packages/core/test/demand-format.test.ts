import { describe, it, expect } from "vitest";
import { formatDemandReadout } from "../src/demand/format.js";
import type { DemandMetric } from "../src/demand/metric.js";
import type { G0Verdict } from "../src/demand/g0-gate.js";

const metric: DemandMetric = {
  externalScansTotal: 7, externalScansSinceLaunch: 3, attributedExternalLogins: 2,
  anonymousScans: 4, distinctExternalRepos: 5, dailyExternalTrend: [{ day: "2026-07-15", count: 2 }],
  badgeServesInWindow: 9, distinctBadgeReposFromGitHub: 6, galleryOptIns: 8, paidSubscriptions: 1,
  externalScansBySource: [{ source: "reddit", count: 5 }], reposWithBadgeServe: 2, reposWithGalleryOptIn: 1,
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
    expect(out).toContain("Scans by source:");
    expect(out).toContain("reddit");
    expect(out).toContain("badge embedded (GitHub) : 2/5");
    expect(out).toContain("gallery opt-in          : 1/5");
  });
});

/**
 * 2026-09-09: the readout led with "external scans (all-time): 15,426", a number that counts
 * unattributed traffic and the owner's own re-scans. Read at a glance it looks like demand. The
 * readout must separate what evidences a stranger from what merely happened.
 */
describe("formatDemandReadout — separates arms-length signal from unattributed volume", () => {
  const metric: DemandMetric = {
    externalScansTotal: 15426, externalScansSinceLaunch: 0, attributedExternalScansSinceLaunch: 0,
    unattributedScans: 15193, attributedExternalLogins: 0, anonymousScans: 15426,
    distinctExternalRepos: 304, dailyExternalTrend: [], badgeServesInWindow: 1730,
    distinctBadgeReposFromGitHub: 0, galleryOptIns: 0, paidSubscriptions: 0,
    externalScansBySource: [], reposWithBadgeServe: 0, reposWithGalleryOptIn: 0,
  };

  it("reports the unattributed count so scan volume is not mistaken for demand", () => {
    const out = formatDemandReadout(metric, { status: "pivot-warning", reasons: [] });
    expect(out).toContain("unattributed scans");
    expect(out).toContain("15193");
  });

  it("labels arms-length signal as its own section", () => {
    const out = formatDemandReadout(metric, { status: "pivot-warning", reasons: [] });
    expect(out).toContain("Arms-length signal");
  });
});
