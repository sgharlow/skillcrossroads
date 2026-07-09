import { describe, it, expect } from "vitest";
import { verify04, parseVerify, mapVerify, type VerifyVerdict } from "../src/checks/verify-04-verification.js";
import { createMemoryCache } from "../src/llm/cache.js";
import type { ModelClient } from "../src/llm/types.js";
import type { CheckContext } from "../src/checks/async.js";
import { makeArtifact } from "./helpers.js";

const GOOD: VerifyVerdict = { score: 90, verifies: true, finding: "Runs the tests before finishing.", suggestion: "" };
const BAD: VerifyVerdict = {
  score: 35,
  verifies: false,
  finding: "Produces output and stops; no self-check.",
  suggestion: "Re-read the result and confirm it matches the request before finishing.",
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

describe("parseVerify", () => {
  it("clamps score and coerces fields", () => {
    const v = parseVerify({ score: 300, verifies: 1, finding: 42, suggestion: null });
    expect(v.score).toBe(100);
    expect(v.verifies).toBe(true);
    expect(v.finding).toBe("42");
    expect(v.suggestion).toBe("");
  });
  it("throws on non-object input", () => {
    expect(() => parseVerify("nope")).toThrow();
  });
});

describe("mapVerify", () => {
  const art = makeArtifact();
  it("passes on a high score", () => {
    expect(mapVerify(art, GOOD).status).toBe("pass");
  });
  it("fails on a low score with a suggestion as the fix", () => {
    const r = mapVerify(art, BAD);
    expect(r.status).toBe("fail");
    expect(r.category).toBe("verifiability");
    expect(r.fix).toMatch(/confirm it matches/);
  });
  it("warns in the middle band", () => {
    expect(mapVerify(art, { ...GOOD, score: 70 }).status).toBe("warn");
  });
});

describe("verify04.run", () => {
  const artifact = makeArtifact({ body: "\n# Do\n1. Build.\n2. Report.\n" });

  it("throws without a model", async () => {
    await expect(verify04.run(artifact, {})).rejects.toThrow(/requires a model/i);
  });

  it("maps the model verdict", async () => {
    const ctx: CheckContext = { model: mockModel(BAD) };
    const r = await verify04.run(artifact, ctx);
    expect(r.id).toBe("VERIFY-04");
    expect(r.status).toBe("fail");
  });

  it("caches by content hash — second run does not call the model", async () => {
    const calls = { n: 0 };
    const ctx: CheckContext = { model: mockModel(GOOD, calls), cache: createMemoryCache() };
    await verify04.run(artifact, ctx);
    await verify04.run(artifact, ctx);
    expect(calls.n).toBe(1);
  });

  it("warns without calling the model when the body is empty", async () => {
    const calls = { n: 0 };
    const r = await verify04.run(makeArtifact({ body: "   " }), { model: mockModel(GOOD, calls) });
    expect(r.status).toBe("warn");
    expect(calls.n).toBe(0);
  });
});
