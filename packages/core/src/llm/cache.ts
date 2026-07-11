import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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
 * Where the verdict cache lives by default: a per-user OS cache directory, NEVER the scanned
 * repo's cwd — a `.beacon-cache/` dropped into a user's repo gets committed by accident (it
 * happened). The one exception is a legacy `./.beacon-cache` that already exists in the cwd:
 * existing setups keep working (and keep their gitignore arrangements) unchanged.
 * Content-hash keys make the per-user cache shared across every repo a user scans — strictly
 * more hits than a per-repo dir.
 */
export function defaultCacheDir(
  opts: { cwd?: string; platform?: NodeJS.Platform; env?: Record<string, string | undefined>; home?: string } = {},
): string {
  const cwd = opts.cwd ?? process.cwd();
  const platform = opts.platform ?? process.platform;
  const env = opts.env ?? process.env;
  const home = opts.home ?? homedir();
  const legacy = join(cwd, ".beacon-cache");
  if (existsSync(legacy)) return legacy;
  if (platform === "win32" && env["LOCALAPPDATA"]) return join(env["LOCALAPPDATA"], "skillcrossroads", "cache");
  if (env["XDG_CACHE_HOME"]) return join(env["XDG_CACHE_HOME"], "skillcrossroads");
  return join(home, ".cache", "skillcrossroads");
}

/**
 * On-disk cache under `dir` (default: `defaultCacheDir()` — per-user, outside the repo).
 * One JSON file per key. Unchanged artifacts re-scan for free: same content hash → cache hit →
 * no model call.
 */
export function createFileCache(dir = defaultCacheDir()): Cache {
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
