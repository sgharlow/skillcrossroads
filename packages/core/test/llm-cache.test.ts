import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashKey, createMemoryCache, createFileCache } from "../src/llm/cache.js";

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
