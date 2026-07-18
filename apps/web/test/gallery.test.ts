import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryGallery, type GalleryStore } from "../lib/gallery";

let g: GalleryStore;

beforeEach(async () => {
  g = createMemoryGallery();
  await g.add({ owner: "a", repo: "r", path: "skills/one", name: "one", grade: "A", overall: 95, scannedAt: "2026-07-01" });
  await g.add({ owner: "b", repo: "s", path: "skills/two", name: "two", grade: "B", overall: 84, scannedAt: "2026-07-08" });
  await g.add({ owner: "c", repo: "t", path: "skills/three", name: "three", grade: "C", overall: 72, scannedAt: "2026-07-05" });
});

describe("gallery store", () => {
  it("counts and de-dups by owner/repo/path", async () => {
    expect(await g.count()).toBe(3);
    await g.add({ owner: "a", repo: "r", path: "skills/one", name: "one", grade: "A+", overall: 100, scannedAt: "2026-07-09" });
    expect(await g.count()).toBe(3); // upsert, not append
    const top = (await g.list({ sort: "score" }))[0]!;
    expect(top.overall).toBe(100); // reflects the update
  });

  it("sorts by score (highest first) by default", async () => {
    const list = await g.list();
    expect(list.map((e) => e.name)).toEqual(["one", "two", "three"]);
  });

  it("sorts by recent", async () => {
    const list = await g.list({ sort: "recent" });
    expect(list.map((e) => e.name)).toEqual(["two", "three", "one"]);
  });

  it("sorts by name", async () => {
    const list = await g.list({ sort: "name" });
    expect(list.map((e) => e.name)).toEqual(["one", "three", "two"]);
  });

  it("filters by minimum grade", async () => {
    const list = await g.list({ minGrade: "B" });
    expect(list.map((e) => e.name).sort()).toEqual(["one", "two"]);
  });

  it("filters by free text over name and repo", async () => {
    expect((await g.list({ q: "three" })).map((e) => e.name)).toEqual(["three"]);
    expect((await g.list({ q: "b/s" })).map((e) => e.name)).toEqual(["two"]);
  });

  it("assigns id = owner/repo/path", async () => {
    const one = (await g.list({ q: "one" }))[0]!;
    expect(one.id).toBe("a/r/skills/one");
  });
});

describe("gallery store — refreshIfListed (F2: never let a listed entry go stale)", () => {
  it("updates grade/overall/name/scannedAt on an existing entry in place (no new row)", async () => {
    await g.refreshIfListed("a/r/skills/one", "one-renamed", "A+", 100, "2026-07-15");
    const listed = (await g.list({ q: "one-renamed" }))[0]!;
    expect(listed.grade).toBe("A+");
    expect(listed.overall).toBe(100);
    expect(listed.scannedAt).toBe("2026-07-15");
    expect(await g.count()).toBe(3); // updated in place, not appended
  });

  it("is a no-op for an id that never opted in — never inserts", async () => {
    await g.refreshIfListed("z/z/skills/ghost", "ghost", "A+", 100, "2026-07-15");
    expect(await g.count()).toBe(3);
    expect(await g.list({ q: "ghost" })).toEqual([]);
  });
});
