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
      [/source IS NOT NULL/s, [{ n: 0 }]], // attributed (referred) scans since launch
      [/FROM scans WHERE source IS NULL/s, [{ n: 0 }]], // unattributed
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
      [/coalesce\(source, 'unknown'\)/s, [{ source: "reddit", count: 5 }, { source: "unknown", count: 2 }]],
      [/JOIN badge_serves b ON/s, [{ n: 3 }]],
      [/JOIN gallery_entries g ON/s, [{ n: 1 }]],
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
      [/source IS NOT NULL/s, [{ n: 0 }]], // attributed (referred) scans since launch
      [/FROM scans WHERE source IS NULL/s, [{ n: 0 }]], // unattributed
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL(?!.*scanned_at)/s, [{ n: 5 }]],
      [/count\(DISTINCT lower\(login\)\)/s, [{ n: 0 }]],
      [/scans WHERE login IS NULL/s, [{ n: 5 }]],
      [/count\(DISTINCT slug\)/s, [{ n: 2 }]],
      [/GROUP BY 1 ORDER BY 1/s, []],
      [/FROM badge_serves WHERE served_at/s, [{ n: 0 }]],
      [/FROM badge_serves\s+WHERE from_github = true/s, [{ n: 0 }]],
      [/FROM gallery_entries/s, [{ n: 0 }]],
      [/FROM subscriptions/s, [{ n: 0 }]],
      [/coalesce\(source, 'unknown'\)/s, [{ source: "reddit", count: 5 }, { source: "unknown", count: 2 }]],
      [/JOIN badge_serves b ON/s, [{ n: 3 }]],
      [/JOIN gallery_entries g ON/s, [{ n: 1 }]],
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

  it("computes external scans by source and scan-to-distribution conversion", async () => {
    const db = fakeDb([
      [/source IS NOT NULL/s, [{ n: 0 }]], // attributed (referred) scans since launch
      [/FROM scans WHERE source IS NULL/s, [{ n: 0 }]], // unattributed
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL.*scanned_at >= \$2/s, [{ n: 3 }]],
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL/s, [{ n: 7 }]],
      [/count\(DISTINCT lower\(login\)\)::int AS n FROM scans/s, [{ n: 2 }]],
      [/count\(\*\)::int AS n FROM scans WHERE login IS NULL/s, [{ n: 4 }]],
      [/count\(DISTINCT slug\)::int AS n FROM scans WHERE \(login IS NULL/s, [{ n: 5 }]],
      [/GROUP BY 1 ORDER BY 1/s, [{ day: "2026-07-15", count: 2 }]],
      [/FROM badge_serves WHERE served_at/s, [{ n: 9 }]],
      [/FROM badge_serves\s+WHERE from_github = true/s, [{ n: 6 }]],
      [/FROM gallery_entries/s, [{ n: 8 }]],
      [/FROM subscriptions WHERE pro = true/s, [{ n: 1 }]],
      [/coalesce\(source, 'unknown'\)/s, [{ source: "reddit", count: 5 }, { source: "unknown", count: 2 }]],
      [/JOIN badge_serves b ON/s, [{ n: 3 }]],
      [/JOIN gallery_entries g ON/s, [{ n: 1 }]],
    ]);
    const m = await computeDemandMetric(db, { ownerLogins: new Set(["sgharlow"]), launchDate: "2026-07-13", trendDays: 30 });
    expect(m.externalScansBySource).toEqual([
      { source: "reddit", count: 5 },
      { source: "unknown", count: 2 },
    ]);
    expect(m.reposWithBadgeServe).toBe(3);
    expect(m.reposWithGalleryOptIn).toBe(1);
  });
});

/**
 * Regression tests for the 2026-09-09 live audit of prod.
 *
 * Found: `badge_serves` and `gallery_entries` were counted with NO owner filter at all, so all 7
 * badge repos (every one `sgharlow/*`) and all 31 gallery entries (`sgharlow/*` + repos the owner
 * scanned himself) were reported as arms-length demand. Separately, `login` is NULL on 100% of
 * 15,510 prod scan rows, so the login-based EXTERNAL predicate excluded nothing and every
 * unattributed scan counted as external.
 */
describe("computeDemandMetric — owner-owned artifacts are not external demand", () => {
  /** Returns the owner-filtered count when the SQL filters the slug's owner segment, else the raw count. */
  function ownerAwareDb(): Queryable {
    return {
      query(text: string) {
        const filtersOwner = /split_part\(slug, *'\/', *1\)/.test(text) || /\bowner\b/.test(text);
        if (/FROM badge_serves\s+WHERE from_github = true/s.test(text)) {
          return Promise.resolve({ rows: [{ n: filtersOwner ? 0 : 7 }] });
        }
        if (/FROM gallery_entries/s.test(text)) {
          return Promise.resolve({ rows: [{ n: filtersOwner ? 0 : 31 }] });
        }
        if (/GROUP BY 1 ORDER BY 1/s.test(text)) return Promise.resolve({ rows: [] });
        if (/coalesce\(source, 'unknown'\)/s.test(text)) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [{ n: 0 }] });
      },
    };
  }

  it("does not count the owner's own repos as badge embeds", async () => {
    const m = await computeDemandMetric(ownerAwareDb(), {
      ownerLogins: new Set(["sgharlow"]),
      launchDate: null,
      trendDays: 30,
    });
    expect(m.distinctBadgeReposFromGitHub).toBe(0);
  });

  it("does not count the owner's own repos as gallery opt-ins", async () => {
    const m = await computeDemandMetric(ownerAwareDb(), {
      ownerLogins: new Set(["sgharlow"]),
      launchDate: null,
      trendDays: 30,
    });
    expect(m.galleryOptIns).toBe(0);
  });
});

describe("computeDemandMetric — a gallery opt-in needs a recorded actor to be evidence", () => {
  /**
   * `gallery_entries.owner` is the SCANNED repo's owner, not whoever opted it in. After the
   * owner-column filter landed, prod still reported 21 opt-ins — every one an `anthropics/skills`
   * entry the owner had scanned and listed himself. Only an entry carrying an `opted_in_by` that
   * is not an owner can evidence a stranger; historical rows have no actor and must not count.
   */
  it("ignores gallery entries with no recorded opted_in_by", async () => {
    const db: Queryable = {
      query(text: string) {
        if (/FROM gallery_entries/s.test(text)) {
          const filtersActor = /opted_in_by/.test(text);
          return Promise.resolve({ rows: [{ n: filtersActor ? 0 : 21 }] });
        }
        if (/GROUP BY 1 ORDER BY 1/s.test(text)) return Promise.resolve({ rows: [] });
        if (/coalesce\(source, 'unknown'\)/s.test(text)) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [{ n: 0 }] });
      },
    };
    const m = await computeDemandMetric(db, {
      ownerLogins: new Set(["sgharlow"]),
      launchDate: null,
      trendDays: 30,
    });
    expect(m.galleryOptIns).toBe(0);
  });
});
