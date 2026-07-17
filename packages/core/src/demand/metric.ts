
/** Minimal structural interface satisfied by a pg Pool/Client — lets tests inject a fake. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

export interface DailyCount {
  day: string; // YYYY-MM-DD
  count: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

export interface DemandMetric {
  externalScansTotal: number;
  externalScansSinceLaunch: number;
  attributedExternalLogins: number;
  anonymousScans: number;
  distinctExternalRepos: number;
  dailyExternalTrend: DailyCount[];
  badgeServesInWindow: number;
  distinctBadgeReposFromGitHub: number;
  galleryOptIns: number;
  paidSubscriptions: number;
  externalScansBySource: SourceCount[];
  reposWithBadgeServe: number;
  reposWithGalleryOptIn: number;
}

export interface DemandMetricOpts {
  ownerLogins: Set<string>;
  launchDate: string | null;
  trendDays: number;
}

// External = anonymous (login IS NULL) OR a login that is not an owner. `<> ALL($1)` is TRUE for
// every row when $1 is an empty array, so an empty owner list counts everything as external.
const EXTERNAL = "(login IS NULL OR lower(login) <> ALL($1::text[]))";

/** The single authoritative computation of the G0 demand signal. Owner exclusion lives ONLY here. */
export async function computeDemandMetric(db: Queryable, opts: DemandMetricOpts): Promise<DemandMetric> {
  const owners = [...opts.ownerLogins].map((l) => l.toLowerCase()); // lowercased text[]
  const days = Math.max(1, Math.trunc(opts.trendDays));

  const scalar = async (text: string, params: unknown[]): Promise<number> =>
    Number((await db.query(text, params)).rows[0]?.n ?? 0);

  const externalScansTotal = await scalar(
    `SELECT count(*)::int AS n FROM scans WHERE ${EXTERNAL}`,
    [owners],
  );
  const externalScansSinceLaunch = opts.launchDate
    ? await scalar(
        `SELECT count(*)::int AS n FROM scans WHERE ${EXTERNAL} AND scanned_at >= $2::date`,
        [owners, opts.launchDate],
      )
    : 0;
  const attributedExternalLogins = await scalar(
    `SELECT count(DISTINCT lower(login))::int AS n FROM scans
     WHERE login IS NOT NULL AND lower(login) <> ALL($1::text[])`,
    [owners],
  );
  const anonymousScans = await scalar(`SELECT count(*)::int AS n FROM scans WHERE login IS NULL`, []);
  const distinctExternalRepos = await scalar(
    `SELECT count(DISTINCT slug)::int AS n FROM scans WHERE ${EXTERNAL}`,
    [owners],
  );
  const dailyExternalTrend = (
    await db.query(
      `SELECT to_char(scanned_at::date, 'YYYY-MM-DD') AS day, count(*)::int AS count
       FROM scans
       WHERE ${EXTERNAL} AND scanned_at >= (CURRENT_DATE - ($2::int - 1))
       GROUP BY 1 ORDER BY 1`,
      [owners, days],
    )
  ).rows as DailyCount[];
  const badgeServesInWindow = await scalar(
    `SELECT count(*)::int AS n FROM badge_serves WHERE served_at >= (CURRENT_DATE - ($1::int - 1))`,
    [days],
  );
  const distinctBadgeReposFromGitHub = await scalar(
    `SELECT count(DISTINCT slug)::int AS n FROM badge_serves
     WHERE from_github = true AND served_at >= (CURRENT_DATE - ($1::int - 1))`,
    [days],
  );
  const galleryOptIns = await scalar(`SELECT count(*)::int AS n FROM gallery_entries`, []);
  const paidSubscriptions = await scalar(`SELECT count(*)::int AS n FROM subscriptions WHERE pro = true`, []);

  const externalScansBySource = (
    await db.query(
      `SELECT coalesce(source, 'unknown') AS source, count(*)::int AS count
       FROM scans WHERE ${EXTERNAL}
       GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT 10`,
      [owners],
    )
  ).rows as SourceCount[];
  const reposWithBadgeServe = await scalar(
    `SELECT count(DISTINCT s.slug)::int AS n
     FROM scans s JOIN badge_serves b ON b.slug = s.slug AND b.from_github = true
     WHERE (s.login IS NULL OR lower(s.login) <> ALL($1::text[]))`,
    [owners],
  );
  const reposWithGalleryOptIn = await scalar(
    `SELECT count(DISTINCT s.slug)::int AS n
     FROM scans s JOIN gallery_entries g ON g.id = s.slug
     WHERE (s.login IS NULL OR lower(s.login) <> ALL($1::text[]))`,
    [owners],
  );

  return {
    externalScansTotal,
    externalScansSinceLaunch,
    attributedExternalLogins,
    anonymousScans,
    distinctExternalRepos,
    dailyExternalTrend,
    badgeServesInWindow,
    distinctBadgeReposFromGitHub,
    galleryOptIns,
    paidSubscriptions,
    externalScansBySource,
    reposWithBadgeServe,
    reposWithGalleryOptIn,
  };
}
