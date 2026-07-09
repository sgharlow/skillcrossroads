import { hasDb, getPool } from "./db";

/** A recorded scan result (for score-history / trend charts — Sprint 11). */
export interface ScanRecord {
  slug: string; // owner/repo/path
  name: string;
  grade: string;
  overall: number;
  rubricVersion: string;
  categoryScores?: Record<string, number | null>;
}

export interface ScanPoint {
  grade: string;
  overall: number;
  scannedAt: string; // ISO
}

export interface ScanHistory {
  record(r: ScanRecord): Promise<void>;
  /** Chronological (oldest → newest) score points for a slug. */
  history(slug: string, limit?: number): Promise<ScanPoint[]>;
}

export function createMemoryScanHistory(): ScanHistory {
  const bySlug = new Map<string, ScanPoint[]>();
  return {
    record(r) {
      const arr = bySlug.get(r.slug) ?? [];
      arr.push({ grade: r.grade, overall: r.overall, scannedAt: new Date().toISOString() });
      bySlug.set(r.slug, arr);
      return Promise.resolve();
    },
    history(slug, limit = 50) {
      return Promise.resolve((bySlug.get(slug) ?? []).slice(-limit));
    },
  };
}

export function createPgScanHistory(pool: import("pg").Pool): ScanHistory {
  return {
    async record(r) {
      await pool.query(
        `INSERT INTO scans (slug, name, grade, overall, rubric_version, category_scores)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [r.slug, r.name, r.grade, r.overall, r.rubricVersion, r.categoryScores ? JSON.stringify(r.categoryScores) : null],
      );
    },
    async history(slug, limit = 50) {
      const res = await pool.query(
        `SELECT grade, overall::float8 AS overall,
                to_char(scanned_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "scannedAt"
         FROM scans WHERE slug=$1 ORDER BY scanned_at DESC LIMIT $2`,
        [slug, limit],
      );
      return (res.rows as ScanPoint[]).reverse(); // chronological
    },
  };
}

/** Process-wide singleton — Postgres when DATABASE_URL is set, else in-memory. */
export const scanHistory: ScanHistory = hasDb() ? createPgScanHistory(getPool()) : createMemoryScanHistory();
