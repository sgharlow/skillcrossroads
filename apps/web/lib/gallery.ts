import { gradeRank, meetsMinGrade } from "@beacon/core";
import { hasDb, getPool } from "./db";

/** One opted-in, publicly-listed skill scorecard. */
export interface GalleryEntry {
  /** `owner/repo/path` — stable id and the route to its scorecard. */
  id: string;
  owner: string;
  repo: string;
  path: string;
  name: string;
  grade: string;
  overall: number;
  /** ISO date the entry was last scored. */
  scannedAt: string;
}

export type GallerySort = "score" | "recent" | "name";

export interface GalleryQuery {
  sort?: GallerySort;
  /** Minimum grade filter, e.g. "A" or "B-". */
  minGrade?: string;
  /** Free-text filter over name + repo. */
  q?: string;
}

/**
 * Opt-in public gallery. In-memory here (per-instance); production backing is Postgres
 * (`gallery_entries`, Build Bible §4.4) — every consumer depends only on this interface.
 */
export interface GalleryStore {
  /** Upsert an entry (dedup by id = owner/repo/path). Returns the stored entry. */
  add(entry: Omit<GalleryEntry, "id">): Promise<GalleryEntry>;
  list(query?: GalleryQuery): Promise<GalleryEntry[]>;
  count(): Promise<number>;
}

function idFor(owner: string, repo: string, path: string): string {
  return [owner, repo, path].filter(Boolean).join("/");
}

/** Filter + sort a set of entries by a query. Shared by the in-memory and Postgres stores. */
export function applyGalleryQuery(entries: GalleryEntry[], query: GalleryQuery = {}): GalleryEntry[] {
  let out = [...entries];
  if (query.minGrade) out = out.filter((e) => meetsMinGrade(e.grade, query.minGrade as string));
  if (query.q) {
    const q = query.q.toLowerCase();
    out = out.filter((e) => `${e.name} ${e.owner}/${e.repo}`.toLowerCase().includes(q));
  }
  const sort = query.sort ?? "score";
  out.sort((a, b) => {
    if (sort === "recent") return b.scannedAt.localeCompare(a.scannedAt);
    if (sort === "name") return a.name.localeCompare(b.name);
    return b.overall - a.overall || gradeRank(a.grade) - gradeRank(b.grade);
  });
  return out;
}

export function createMemoryGallery(): GalleryStore {
  const byId = new Map<string, GalleryEntry>();
  return {
    add(input) {
      const id = idFor(input.owner, input.repo, input.path);
      const entry: GalleryEntry = { ...input, id };
      byId.set(id, entry);
      return Promise.resolve(entry);
    },
    list: (query = {}) => Promise.resolve(applyGalleryQuery([...byId.values()], query)),
    count: () => Promise.resolve(byId.size),
  };
}

/** Postgres-backed gallery (production). Filter/sort reuse applyGalleryQuery for parity. */
export function createPgGallery(pool: import("pg").Pool): GalleryStore {
  return {
    async add(input) {
      const id = idFor(input.owner, input.repo, input.path);
      await pool.query(
        `INSERT INTO gallery_entries (id, owner, repo, path, name, grade, overall, scanned_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE
           SET name=$5, grade=$6, overall=$7, scanned_at=$8`,
        [id, input.owner, input.repo, input.path, input.name, input.grade, input.overall, input.scannedAt],
      );
      return { ...input, id };
    },
    async list(query = {}) {
      const r = await pool.query(
        `SELECT id, owner, repo, path, name, grade, overall::float8 AS overall,
                to_char(scanned_at, 'YYYY-MM-DD') AS "scannedAt"
         FROM gallery_entries`,
      );
      return applyGalleryQuery(r.rows as GalleryEntry[], query);
    },
    async count() {
      const r = await pool.query("SELECT count(*)::int AS c FROM gallery_entries");
      return r.rows[0].c as number;
    },
  };
}

/**
 * A starter leaderboard (real Beacon scores) — only for the in-memory dev store, never the DB.
 * Exported so tests can assert the seed contract directly (no test/fixtures paths, no
 * near-duplicate demo-recipe spam) without depending on process.env.DATABASE_URL at import time.
 */
export const SEED: Omit<GalleryEntry, "id">[] = [
  { owner: "anthropics", repo: "skills", path: "skills/algorithmic-art", name: "algorithmic-art", grade: "A+", overall: 100, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/canvas-design", name: "canvas-design", grade: "A+", overall: 100, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/brand-guidelines", name: "brand-guidelines", grade: "A+", overall: 100, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/doc-coauthoring", name: "doc-coauthoring", grade: "A+", overall: 100, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/claude-api", name: "claude-api", grade: "A−", overall: 92.3, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/docx", name: "docx", grade: "A−", overall: 92.3, scannedAt: "2026-07-08" },
];

function seededMemoryGallery(): GalleryStore {
  const g = createMemoryGallery();
  for (const e of SEED) void g.add(e); // Map.set is synchronous inside add()
  return g;
}

/**
 * Process-wide singleton — Postgres when DATABASE_URL is set, else a seeded in-memory store.
 * In-memory state is per-instance (not shared across Next route/page bundles or serverless
 * instances), which is exactly why production must back this with Postgres. The seed populates
 * only the dev store, never the real DB.
 */
export const gallery: GalleryStore = hasDb() ? createPgGallery(getPool()) : seededMemoryGallery();
