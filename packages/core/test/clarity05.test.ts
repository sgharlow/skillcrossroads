import { describe, it, expect } from "vitest";
import {
  clarity05,
  parseConstraints,
  mapConstraints,
  type ConstraintVerdict,
} from "../src/checks/clarity-05-constraints.js";
import { createMemoryCache } from "../src/llm/cache.js";
import type { ModelClient } from "../src/llm/types.js";
import type { CheckContext } from "../src/checks/async.js";
import { makeArtifact } from "./helpers.js";

const GOOD: ConstraintVerdict = {
  score: 88,
  statesConstraints: true,
  finding: "Handles empty input and ambiguous owners.",
  suggestion: "",
};
const BAD: ConstraintVerdict = {
  score: 30,
  statesConstraints: false,
  finding: "Describes only the happy path; no edge cases.",
  suggestion: "State what to do on empty or malformed input.",
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

describe("parseConstraints", () => {
  it("clamps score and coerces fields", () => {
    const v = parseConstraints({ score: -5, statesConstraints: "yes", finding: 1, suggestion: undefined });
    expect(v.score).toBe(0);
    expect(v.statesConstraints).toBe(true);
    expect(v.finding).toBe("1");
    expect(v.suggestion).toBe("");
  });
  it("throws on non-object input", () => {
    expect(() => parseConstraints(3)).toThrow();
  });
});

describe("mapConstraints", () => {
  const art = makeArtifact();
  it("passes on a high score, category clarity", () => {
    const r = mapConstraints(art, GOOD);
    expect(r.status).toBe("pass");
    expect(r.category).toBe("clarity");
    expect(r.id).toBe("CLARITY-05");
  });
  it("fails on a low score with the suggestion as fix", () => {
    const r = mapConstraints(art, BAD);
    expect(r.status).toBe("fail");
    expect(r.fix).toMatch(/malformed input/);
  });
  it("warns in the middle band", () => {
    expect(mapConstraints(art, { ...GOOD, score: 65 }).status).toBe("warn");
  });
});

describe("clarity05.run", () => {
  const artifact = makeArtifact({ body: "\n# Do\n1. Read input.\n2. Output result.\n" });

  it("throws without a model", async () => {
    await expect(clarity05.run(artifact, {})).rejects.toThrow(/requires a model/i);
  });

  it("caches by content hash — second run does not call the model", async () => {
    const calls = { n: 0 };
    const ctx: CheckContext = { model: mockModel(GOOD, calls), cache: createMemoryCache() };
    await clarity05.run(artifact, ctx);
    await clarity05.run(artifact, ctx);
    expect(calls.n).toBe(1);
  });

  it("warns without a model call when the body is empty", async () => {
    const calls = { n: 0 };
    const r = await clarity05.run(makeArtifact({ body: "  " }), { model: mockModel(GOOD, calls) });
    expect(r.status).toBe("warn");
    expect(calls.n).toBe(0);
  });
});
