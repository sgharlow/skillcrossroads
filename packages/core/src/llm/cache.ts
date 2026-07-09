import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/** A content-addressed verdict cache. Keys are hashes; values are JSON-serializable verdicts. */
export interface Cache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

/** Stable cache key from arbitrary string parts (check id, rubric version, model, content...). */
export function hashKey(...parts: string[]): string {
  const h = createHash("sha256");
  for (const p of parts) {
    h.update(p);
    h.update("\0");
  }
  return h.digest("hex");
}

/** In-memory cache — used in tests and single-process runs. */
export function createMemoryCache(): Cache {
  const store = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
  };
}

/**
 * On-disk cache under `dir` (default `.beacon-cache`). One JSON file per key. Unchanged
 * artifacts re-scan for free: same content hash → cache hit → no model call.
 */
export function createFileCache(dir = ".beacon-cache"): Cache {
  const ensureDir = (): void => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  };
  const pathFor = (key: string): string => join(dir, `${key}.json`);
  return {
    get(key) {
      try {
        const raw = readFileSync(pathFor(key), "utf8");
        return Promise.resolve(JSON.parse(raw));
      } catch {
        return Promise.resolve(undefined);
      }
    },
    set(key, value) {
      try {
        ensureDir();
        writeFileSync(pathFor(key), JSON.stringify(value), "utf8");
      } catch {
        // Cache is best-effort; a write failure must never fail a scan.
      }
      return Promise.resolve();
    },
  };
}
