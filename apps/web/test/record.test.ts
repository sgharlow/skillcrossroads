import { describe, it, expect, vi, afterEach } from "vitest";
import type { ScannedSkill } from "@beacon/core";
import { recordScans } from "../lib/record";
import { gallery, SEED } from "../lib/gallery";

/** Minimal ScannedSkill fixture — recordScans only reads repoPath/name/scorecard. */
function skill(repoPath: string, name: string, grade: string, overall: number): ScannedSkill {
  return {
    repoPath,
    name,
    scorecard: { grade, overall, rubricVersion: "1.2", categories: [] },
  } as unknown as ScannedSkill;
}

describe("recordScans — gallery refresh (F2: gallery grades must not go stale vs live scans)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes an existing gallery-listed entry to the fresh scan's grade/overall", async () => {
    const seeded = SEED[0]!; // opted-in SEED entry, originally A+ 100
    await recordScans(seeded.owner, seeded.repo, [skill(seeded.path, seeded.name, "A", 96.3)]);
    const listed = (await gallery.list({ q: seeded.name })).find(
      (e) => e.id === `${seeded.owner}/${seeded.repo}/${seeded.path}`,
    );
    expect(listed?.grade).toBe("A");
    expect(listed?.overall).toBe(96.3);
  });

  it("does not create a new gallery entry for an artifact that never opted in", async () => {
    const before = await gallery.count();
    await recordScans("nobody", "not-listed", [skill("skills/ghost", "ghost", "B", 84)]);
    expect(await gallery.count()).toBe(before);
    expect(await gallery.list({ q: "ghost" })).toEqual([]);
  });

  it("swallows a gallery refresh error without failing the scan record", async () => {
    vi.spyOn(gallery, "refreshIfListed").mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordScans("anthropics", "skills", [skill("skills/canvas-design", "canvas-design", "B", 84)]),
    ).resolves.toBeUndefined();
  });
});
