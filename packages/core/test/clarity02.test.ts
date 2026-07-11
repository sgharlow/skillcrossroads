import { describe, it, expect } from "vitest";
import {
  clarity02,
  parseContradictions,
  mapContradictions,
  type ContradictionVerdict,
} from "../src/checks/clarity-02-contradictions.js";
import { createMemoryCache } from "../src/llm/cache.js";
import type { ModelClient } from "../src/llm/types.js";
import type { CheckContext } from "../src/checks/async.js";
import { makeArtifact } from "./helpers.js";

const GOOD: ContradictionVerdict = {
  score: 92,
  consistent: true,
  contradictions: [],
  suggestion: "",
};
const BAD: ContradictionVerdict = {
  score: 35,
  consistent: false,
  contradictions: ['"always commit after every change" vs "never commit; leave staging to the user"'],
  suggestion: "Keep one committing rule and delete the other.",
};

function mockModel(verdict: unknown, calls = { n: 0 }): ModelClient {
  return {
    name: "mock-model",
    async generateStructured() {
      calls.n++;
      return verdict;
    },
  };
}

describe("parseContradictions", () => {
  it("clamps score and coerces fields", () => {
    const v = parseContradictions({ score: 150, consistent: "yes", contradictions: [1, "b"], suggestion: undefined });
    expect(v.score).toBe(100);
    expect(v.consistent).toBe(true);
    expect(v.contradictions).toEqual(["1", "b"]);
    expect(v.suggestion).toBe("");
  });
  it("treats a non-array contradictions field as empty", () => {
    expect(parseContradictions({ score: 50, consistent: false, contradictions: "nope", suggestion: "" }).contradictions).toEqual([]);
  });
  it("throws on non-object input", () => {
    expect(() => parseContradictions("nope")).toThrow();
  });
});

describe("mapContradictions", () => {
  const art = makeArtifact();
  it("passes at >=80, category clarity", () => {
    const r = mapContradictions(art, GOOD);
    expect(r.status).toBe("pass");
    expect(r.category).toBe("clarity");
    expect(r.id).toBe("CLARITY-02");
    expect(mapContradictions(art, { ...GOOD, score: 80 }).status).toBe("pass");
  });
  it("fails on a low score, quoting each conflict as evidence with the suggestion as fix", () => {
    const r = mapContradictions(art, BAD);
    expect(r.status).toBe("fail");
    expect(r.fix).toMatch(/delete the other/);
    const snippets = r.evidence.map((e) => e.snippet).filter(Boolean);
    expect(snippets[0]).toMatch(/always commit.*never commit/i);
  });
  it("warns in the middle band", () => {
    expect(mapContradictions(art, { ...GOOD, score: 65 }).status).toBe("warn");
  });
});

describe("clarity02.run", () => {
  const artifact = makeArtifact({ body: "\n# Do\n1. Read input.\n2. Output result.\n" });

  it("throws without a model", async () => {
    await expect(clarity02.run(artifact, {})).rejects.toThrow(/requires a model/i);
  });

  it("caches by content hash — second run does not call the model", async () => {
    const calls = { n: 0 };
    const ctx: CheckContext = { model: mockModel(GOOD, calls), cache: createMemoryCache() };
    await clarity02.run(artifact, ctx);
    await clarity02.run(artifact, ctx);
    expect(calls.n).toBe(1);
  });

  it("warns without a model call when the body is empty", async () => {
    const calls = { n: 0 };
    const r = await clarity02.run(makeArtifact({ body: "  " }), { model: mockModel(GOOD, calls) });
    expect(r.status).toBe("warn");
    expect(calls.n).toBe(0);
  });
});
