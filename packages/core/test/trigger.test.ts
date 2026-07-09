import { describe, it, expect } from "vitest";
import {
  trigger01,
  parseVerdict,
  mapVerdict,
  type TriggerVerdict,
} from "../src/checks/trigger-01-triggering.js";
import { createMemoryCache } from "../src/llm/cache.js";
import type { ModelClient } from "../src/llm/types.js";
import type { CheckContext } from "../src/checks/async.js";
import { makeArtifact } from "./helpers.js";

const GOOD: TriggerVerdict = {
  score: 88,
  wouldReliablyTrigger: true,
  issues: [],
  suggestedTriggerPhrases: [],
};
const BAD: TriggerVerdict = {
  score: 40,
  wouldReliablyTrigger: false,
  issues: [{ severity: "high", finding: "Description is too generic to fire." }],
  suggestedTriggerPhrases: ["turn my notes into action items"],
};

/** A ModelClient that returns a canned verdict and counts calls. */
function mockModel(verdict: unknown, calls = { n: 0 }): ModelClient {
  return {
    name: "mock-model",
    async generateStructured() {
      calls.n++;
      return verdict;
    },
  };
}

describe("parseVerdict", () => {
  it("clamps score and coerces fields", () => {
    const v = parseVerdict({ score: 250, wouldReliablyTrigger: 1, issues: "x", suggestedTriggerPhrases: null });
    expect(v.score).toBe(100);
    expect(v.wouldReliablyTrigger).toBe(true);
    expect(v.issues).toEqual([]);
    expect(v.suggestedTriggerPhrases).toEqual([]);
  });
  it("defaults an unknown severity to medium and drops empty findings", () => {
    const v = parseVerdict({ score: 50, issues: [{ severity: "weird", finding: "x" }, { finding: "" }] });
    expect(v.issues).toEqual([{ severity: "medium", finding: "x" }]);
  });
  it("throws on non-object input", () => {
    expect(() => parseVerdict(null)).toThrow();
  });
});

describe("mapVerdict", () => {
  const art = makeArtifact({ frontmatter: { name: "x", description: "do a thing" } });
  it("passes on a high score", () => {
    expect(mapVerdict(art, "do a thing", GOOD).status).toBe("pass");
  });
  it("fails on a low score with issue evidence and a fix", () => {
    const r = mapVerdict(art, "do a thing", BAD);
    expect(r.status).toBe("fail");
    expect(r.score).toBe(40);
    expect(r.evidence.some((e) => /too generic/.test(e.message))).toBe(true);
    expect(r.fix).toMatch(/turn my notes into action items/);
  });
  it("warns in the middle band", () => {
    expect(mapVerdict(art, "d", { ...GOOD, score: 70 }).status).toBe("warn");
  });
});

describe("trigger01.run", () => {
  const artifact = makeArtifact({ frontmatter: { name: "meeting-notes", description: "Turn notes into action items." } });

  it("throws without a model (deterministic-only guard)", async () => {
    await expect(trigger01.run(artifact, {})).rejects.toThrow(/requires a model/i);
  });

  it("returns a mapped result from the model verdict", async () => {
    const ctx: CheckContext = { model: mockModel(BAD) };
    const r = await trigger01.run(artifact, ctx);
    expect(r.id).toBe("TRIGGER-01");
    expect(r.category).toBe("triggering");
    expect(r.status).toBe("fail");
  });

  it("caches by content hash — second run does not call the model", async () => {
    const calls = { n: 0 };
    const ctx: CheckContext = { model: mockModel(GOOD, calls), cache: createMemoryCache() };
    await trigger01.run(artifact, ctx);
    await trigger01.run(artifact, ctx);
    expect(calls.n).toBe(1); // cache hit on the second run
  });

  it("fails fast without calling the model when there is no description", async () => {
    const calls = { n: 0 };
    const noDesc = makeArtifact({ frontmatter: { name: "x" } });
    const r = await trigger01.run(noDesc, { model: mockModel(GOOD, calls) });
    expect(r.status).toBe("fail");
    expect(calls.n).toBe(0);
  });
});
