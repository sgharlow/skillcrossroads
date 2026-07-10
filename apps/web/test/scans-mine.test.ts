import { describe, it, expect } from "vitest";
import { createMemoryScanHistory, type ScanRecord } from "../lib/scans";

const rec = (slug: string, grade: string, over: number, login?: string): ScanRecord => ({
  slug,
  name: slug.split("/").pop() ?? slug,
  grade,
  overall: over,
  rubricVersion: "1.1",
  ...(login ? { login } : {}),
});

describe("scanHistory.mine — per-user scan history", () => {
  it("returns only the requesting user's scans (scoped by login)", async () => {
    const h = createMemoryScanHistory();
    await h.record(rec("a/one", "A", 95, "alice"));
    await h.record(rec("b/two", "B", 85, "bob"));

    const mine = await h.mine("alice");
    expect(mine.map((r) => r.slug)).toEqual(["a/one"]);
    expect(mine.some((r) => r.slug === "b/two")).toBe(false);
  });

  it("dedupes to the latest scan per repo", async () => {
    const h = createMemoryScanHistory();
    await h.record(rec("a/repo", "C", 72, "alice"));
    await h.record(rec("a/repo", "A", 96, "alice")); // rescanned — higher grade

    const mine = await h.mine("alice");
    expect(mine).toHaveLength(1);
    expect(mine[0]!.grade).toBe("A");
    expect(mine[0]!.overall).toBe(96);
  });

  it("never surfaces anonymous scans (no login) in anyone's history", async () => {
    const h = createMemoryScanHistory();
    await h.record(rec("x/anon", "A", 90)); // anonymous — login omitted
    expect(await h.mine("alice")).toEqual([]);
    // …but anonymous scans still count in the global recent feed.
    const recent = await h.recent();
    expect(recent.some((r) => r.slug === "x/anon")).toBe(true);
  });

  it("recent() does not leak the login field into its rows", async () => {
    const h = createMemoryScanHistory();
    await h.record(rec("a/one", "A", 95, "alice"));
    const recent = await h.recent();
    expect(recent[0]).not.toHaveProperty("login");
  });

  it("honors the limit", async () => {
    const h = createMemoryScanHistory();
    for (let i = 0; i < 5; i++) await h.record(rec(`alice/repo${i}`, "A", 90, "alice"));
    expect(await h.mine("alice", 3)).toHaveLength(3);
  });
});
