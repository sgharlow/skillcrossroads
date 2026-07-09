import { gradeRank, meetsMinGrade } from "@beacon/core";

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

export function createMemoryGallery(): GalleryStore {
  const byId = new Map<string, GalleryEntry>();
  return {
    add(input) {
      const id = idFor(input.owner, input.repo, input.path);
      const entry: GalleryEntry = { ...input, id };
      byId.set(id, entry);
      return Promise.resolve(entry);
    },
    list(query = {}) {
      let out = [...byId.values()];
      if (query.minGrade) out = out.filter((e) => meetsMinGrade(e.grade, query.minGrade as string));
      if (query.q) {
        const q = query.q.toLowerCase();
        out = out.filter((e) => `${e.name} ${e.owner}/${e.repo}`.toLowerCase().includes(q));
      }
      const sort = query.sort ?? "score";
      out.sort((a, b) => {
        if (sort === "recent") return b.scannedAt.localeCompare(a.scannedAt);
        if (sort === "name") return a.name.localeCompare(b.name);
        // score: highest overall first, then better grade as a tiebreak
        return b.overall - a.overall || gradeRank(a.grade) - gradeRank(b.grade);
      });
      return Promise.resolve(out);
    },
    count: () => Promise.resolve(byId.size),
  };
}

/**
 * Process-wide singleton (in-memory in v0.1). NOTE: in-memory state is per-instance and is NOT
 * shared across Next route/page bundles or serverless instances — production must back this with
 * Postgres (`gallery_entries`). The seed below gives every instance the same starter leaderboard
 * (real Beacon scores) so the gallery renders consistently until the DB is wired.
 */
export const gallery: GalleryStore = createMemoryGallery();

const SEED: Omit<GalleryEntry, "id">[] = [
  { owner: "anthropics", repo: "skills", path: "skills/algorithmic-art", name: "algorithmic-art", grade: "A+", overall: 100, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/canvas-design", name: "canvas-design", grade: "A+", overall: 100, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/brand-guidelines", name: "brand-guidelines", grade: "A+", overall: 100, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/doc-coauthoring", name: "doc-coauthoring", grade: "A+", overall: 100, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/claude-api", name: "claude-api", grade: "A−", overall: 92.3, scannedAt: "2026-07-08" },
  { owner: "anthropics", repo: "skills", path: "skills/docx", name: "docx", grade: "A−", overall: 92.3, scannedAt: "2026-07-08" },
];
// Map.set runs synchronously inside add(), so the store is populated before first use.
for (const e of SEED) void gallery.add(e);
