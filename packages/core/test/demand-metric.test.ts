import { describe, it, expect } from "vitest";
import { computeDemandMetric, type Queryable } from "../src/demand/metric.js";

/** Fake Queryable that returns rows for the first handler whose regex matches the SQL. */
function fakeDb(handlers: Array<[RegExp, any[]]>): Queryable {
  return {
    query(text: string) {
      for (const [re, rows] of handlers) if (re.test(text)) return Promise.resolve({ rows });
      return Promise.reject(new Error("unexpected query: " + text.replace(/\s+/g, " ").trim()));
    },
  };
}

describe("computeDemandMetric", () => {
  it("aggregates external counts and excludes owners; anonymous reported separately", async () => {
    const db = fakeDb([
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL.*scanned_at >= \$2/s, [{ n: 3 }]], // since launch
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL/s, [{ n: 7 }]], // external total
      [/count\(DISTINCT lower\(login\)\)::int AS n FROM scans/s, [{ n: 2 }]], // attributed logins
      [/count\(\*\)::int AS n FROM scans WHERE login IS NULL/s, [{ n: 4 }]], // anonymous
      [/count\(DISTINCT slug\)::int AS n FROM scans WHERE \(login IS NULL/s, [{ n: 5 }]], // distinct repos
      [/GROUP BY 1 ORDER BY 1/s, [{ day: "2026-07-14", count: 1 }, { day: "2026-07-15", count: 2 }]], // trend
      [/FROM badge_serves WHERE served_at/s, [{ n: 9 }]], // badge serves in window
      [/FROM badge_serves\s+WHERE from_github = true/s, [{ n: 6 }]], // badge repos via github
      [/FROM gallery_entries/s, [{ n: 8 }]],
      [/FROM subscriptions WHERE pro = true/s, [{ n: 1 }]],
    ]);
    const m = await computeDemandMetric(db, {
      ownerLogins: new Set(["sgharlow"]),
      launchDate: "2026-07-13",
      trendDays: 30,
    });
    expect(m.externalScansTotal).toBe(7);
    expect(m.externalScansSinceLaunch).toBe(3);
    expect(m.attributedExternalLogins).toBe(2);
    expect(m.anonymousScans).toBe(4);
    expect(m.distinctExternalRepos).toBe(5);
    expect(m.dailyExternalTrend).toEqual([
      { day: "2026-07-14", count: 1 },
      { day: "2026-07-15", count: 2 },
    ]);
    expect(m.badgeServesInWindow).toBe(9);
    expect(m.distinctBadgeReposFromGitHub).toBe(6);
    expect(m.galleryOptIns).toBe(8);
    expect(m.paidSubscriptions).toBe(1);
  });

  it("returns externalScansSinceLaunch = 0 when there is no launch date (no date query issued)", async () => {
    const db = fakeDb([
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL(?!.*scanned_at)/s, [{ n: 5 }]],
      [/count\(DISTINCT lower\(login\)\)/s, [{ n: 0 }]],
      [/scans WHERE login IS NULL/s, [{ n: 5 }]],
      [/count\(DISTINCT slug\)/s, [{ n: 2 }]],
      [/GROUP BY 1 ORDER BY 1/s, []],
      [/FROM badge_serves WHERE served_at/s, [{ n: 0 }]],
      [/from_github = true/s, [{ n: 0 }]],
      [/FROM gallery_entries/s, [{ n: 0 }]],
      [/FROM subscriptions/s, [{ n: 0 }]],
    ]);
    const m = await computeDemandMetric(db, { ownerLogins: new Set(), launchDate: null, trendDays: 30 });
    expect(m.externalScansSinceLaunch).toBe(0);
    expect(m.externalScansTotal).toBe(5);
  });

  it("lowercases owner logins before passing them to SQL", async () => {
    let capturedOwners: unknown = null;
    const db = {
      query(text: string, params?: unknown[]) {
        if (/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL/s.test(text) && !/scanned_at/.test(text)) {
          capturedOwners = params?.[0];
        }
        return Promise.resolve({ rows: [{ n: 0 }] });
      },
    };
    await computeDemandMetric(db, { ownerLogins: new Set(["SGharlow", "FOO"]), launchDate: null, trendDays: 30 });
    expect(capturedOwners).toEqual(["sgharlow", "foo"]);
  });
});
