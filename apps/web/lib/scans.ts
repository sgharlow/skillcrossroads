import { hasDb, getPool } from "./db";

/** A recorded scan result (for score-history / trend charts). */
export interface ScanRecord {
  slug: string; // owner/repo/path
  name: string;
  grade: string;
  overall: number;
  rubricVersion: string;
  categoryScores?: Record<string, number | null>;
  /** The signed-in user who ran the scan. Omitted for anonymous scans (they stay anonymous). */
  login?: string;
  /** Attribution source (campaign ref / referrer). Omitted for unattributed scans. */
  source?: string;
}

export interface ScanPoint {
  grade: string;
  overall: number;
  scannedAt: string; // ISO
}

export interface ScanRow extends ScanPoint {
  slug: string;
  name: string;
}

export interface ScanStats {
  totalScans: number;
  distinctSkills: number;
  /** Distribution of each skill's most-recent grade. */
  byGrade: Record<string, number>;
}

export interface ScanHistory {
  record(r: ScanRecord): Promise<void>;
  /** Chronological (oldest → newest) score points for one slug. */
  history(slug: string, limit?: number): Promise<ScanPoint[]>;
  /** Most-recent scans across all slugs (for the metrics dashboard). */
  recent(limit?: number): Promise<ScanRow[]>;
  /** The latest scan of each distinct repo this user ran (most-recent first) — for /account. */
  mine(login: string, limit?: number): Promise<ScanRow[]>;
  stats(): Promise<ScanStats>;
}

export function createMemoryScanHistory(): ScanHistory {
  const all: Array<ScanRow & { login?: string; source?: string }> = [];
  return {
    record(r) {
      all.push({ slug: r.slug, name: r.name, grade: r.grade, overall: r.overall, scannedAt: new Date().toISOString(), login: r.login, source: r.source });
      return Promise.resolve();
    },
    history(slug, limit = 50) {
      return Promise.resolve(all.filter((s) => s.slug === slug).slice(-limit).map(({ grade, overall, scannedAt }) => ({ grade, overall, scannedAt })));
    },
    recent(limit = 20) {
      return Promise.resolve([...all].reverse().slice(0, limit).map(({ login: _login, ...row }) => row));
    },
    mine(login, limit = 15) {
      const latest = new Map<string, ScanRow>();
      // Rows are appended in scan order, so the last write per slug is that slug's most-recent scan.
      for (const s of all) if (s.login === login) latest.set(s.slug, { slug: s.slug, name: s.name, grade: s.grade, overall: s.overall, scannedAt: s.scannedAt });
      const rows = [...latest.values()].sort((a, b) => (a.scannedAt < b.scannedAt ? 1 : -1));
      return Promise.resolve(rows.slice(0, limit));
    },
    stats() {
      const latest = new Map<string, string>();
      for (const s of all) latest.set(s.slug, s.grade); // last write wins = most recent
      const byGrade: Record<string, number> = {};
      for (const g of latest.values()) byGrade[g] = (byGrade[g] ?? 0) + 1;
      return Promise.resolve({ totalScans: all.length, distinctSkills: latest.size, byGrade });
    },
  };
}

export function createPgScanHistory(pool: import("pg").Pool): ScanHistory {
  return {
    async record(r) {
      await pool.query(
        `INSERT INTO scans (slug, name, grade, overall, rubric_version, category_scores, login, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [r.slug, r.name, r.grade, r.overall, r.rubricVersion, r.categoryScores ? JSON.stringify(r.categoryScores) : null, r.login ?? null, r.source ?? null],
      );
    },
    async history(slug, limit = 50) {
      const res = await pool.query(
        `SELECT grade, overall::float8 AS overall,
                to_char(scanned_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "scannedAt"
         FROM scans WHERE slug=$1 ORDER BY scanned_at DESC LIMIT $2`,
        [slug, limit],
      );
      return (res.rows as ScanPoint[]).reverse();
    },
    async recent(limit = 20) {
      const res = await pool.query(
        `SELECT slug, name, grade, overall::float8 AS overall,
                to_char(scanned_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "scannedAt"
         FROM scans ORDER BY scanned_at DESC LIMIT $1`,
        [limit],
      );
      return res.rows as ScanRow[];
    },
    async mine(login, limit = 15) {
      // Latest scan of each distinct repo this user ran, most-recent first.
      const res = await pool.query(
        `SELECT slug, name, grade, overall, "scannedAt" FROM (
           SELECT DISTINCT ON (slug) slug, name, grade, overall::float8 AS overall,
                  to_char(scanned_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "scannedAt", scanned_at
           FROM scans WHERE login = $1 ORDER BY slug, scanned_at DESC
         ) t ORDER BY t.scanned_at DESC LIMIT $2`,
        [login, limit],
      );
      return res.rows as ScanRow[];
    },
    async stats() {
      const totals = await pool.query("SELECT count(*)::int AS total, count(DISTINCT slug)::int AS skills FROM scans");
      const grades = await pool.query(
        `SELECT grade, count(*)::int AS n FROM (
           SELECT DISTINCT ON (slug) slug, grade FROM scans ORDER BY slug, scanned_at DESC
         ) t GROUP BY grade`,
      );
      const byGrade: Record<string, number> = {};
      for (const row of grades.rows) byGrade[row.grade] = row.n;
      return { totalScans: totals.rows[0].total, distinctSkills: totals.rows[0].skills, byGrade };
    },
  };
}

/** Process-wide singleton — Postgres when DATABASE_URL is set, else in-memory. */
export const scanHistory: ScanHistory = hasDb() ? createPgScanHistory(getPool()) : createMemoryScanHistory();
