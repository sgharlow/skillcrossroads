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
