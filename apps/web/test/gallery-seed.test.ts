import { describe, it, expect } from "vitest";
import { SEED } from "../lib/gallery";

describe("gallery SEED contract", () => {
  it("contains no test-fixture paths", () => {
    const offenders = SEED.filter((e) => e.path.includes("test/fixtures"));
    expect(offenders).toEqual([]);
  });

  it("has no more than 2 entries sharing an owner/repo + name-prefix 'recipe-' pattern", () => {
    const counts = new Map<string, number>();
    for (const e of SEED) {
      if (!e.name.startsWith("recipe-")) continue;
      const key = `${e.owner}/${e.repo}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it("has no known embarrassing fixture names (has-secrets/vulnerable and their fixture display names)", () => {
    const bannedNames = ["has-secrets", "vulnerable", "deploy-helper", "deploy-all"];
    const offenders = SEED.filter((e) => bannedNames.includes(e.name));
    expect(offenders).toEqual([]);
  });
});
