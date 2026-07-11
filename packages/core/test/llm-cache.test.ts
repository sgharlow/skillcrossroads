import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashKey, createMemoryCache, createFileCache, defaultCacheDir } from "../src/llm/cache.js";

describe("hashKey", () => {
  it("is deterministic for the same parts", () => {
    expect(hashKey("a", "b", "c")).toBe(hashKey("a", "b", "c"));
  });
  it("is order- and boundary-sensitive", () => {
    expect(hashKey("a", "b")).not.toBe(hashKey("b", "a"));
    expect(hashKey("ab", "c")).not.toBe(hashKey("a", "bc"));
  });
});

describe("createMemoryCache", () => {
  it("round-trips values", async () => {
    const c = createMemoryCache();
    expect(await c.get("k")).toBeUndefined();
    await c.set("k", { score: 90 });
    expect(await c.get("k")).toEqual({ score: 90 });
  });
});

describe("defaultCacheDir — never pollute the scanned repo", () => {
  it("uses the per-user cache dir on win32 (%LOCALAPPDATA%)", () => {
    const d = defaultCacheDir({ cwd: "/some/repo", platform: "win32", env: { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" }, home: "C:\\Users\\u" });
    expect(d).toBe(join("C:\\Users\\u\\AppData\\Local", "skillcrossroads", "cache"));
  });
  it("honors XDG_CACHE_HOME on POSIX", () => {
    const d = defaultCacheDir({ cwd: "/some/repo", platform: "linux", env: { XDG_CACHE_HOME: "/xdg" }, home: "/home/u" });
    expect(d).toBe(join("/xdg", "skillcrossroads"));
  });
  it("falls back to ~/.cache on POSIX", () => {
    const d = defaultCacheDir({ cwd: "/some/repo", platform: "darwin", env: {}, home: "/Users/u" });
    expect(d).toBe(join("/Users/u", ".cache", "skillcrossroads"));
  });
  it("keeps using a legacy ./.beacon-cache when one already exists in the cwd", () => {
    const cwd = mkdtempSync(join(tmpdir(), "beacon-legacy-"));
    try {
      mkdirSync(join(cwd, ".beacon-cache"));
      const d = defaultCacheDir({ cwd, platform: "linux", env: {}, home: "/home/u" });
      expect(d).toBe(join(cwd, ".beacon-cache"));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("createFileCache", () => {
  it("persists values to disk and reads them back", async () => {
    const dir = mkdtempSync(join(tmpdir(), "beacon-cache-"));
    try {
      const c = createFileCache(dir);
      expect(await c.get("k")).toBeUndefined();
      await c.set("k", { verdict: true, n: 42 });
      expect(await c.get("k")).toEqual({ verdict: true, n: 42 });
      // a fresh instance over the same dir sees the persisted value
      expect(await createFileCache(dir).get("k")).toEqual({ verdict: true, n: 42 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
