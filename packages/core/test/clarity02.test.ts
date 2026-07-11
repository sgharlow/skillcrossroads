import { describe, it, expect } from "vitest";
import {
  clarity02,
  parseContradictions,
  mapContradictions,
  BODY_SLICE_CHARS,
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
  it("clamps an out-of-range numeric score and coerces the loose fields", () => {
    const v = parseContradictions({ score: 150, consistent: true, contradictions: [1, "b"], suggestion: undefined });
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
  // A degenerate verdict (e.g. a truncated tool call) must THROW so runChecksAsync drops the
  // check via onError — the old coercion to score 0 turned a model failure into a false FAIL.
  it("throws on a missing or non-numeric score instead of coercing to 0", () => {
    expect(() => parseContradictions({ consistent: true, contradictions: [], suggestion: "" })).toThrow(/score/i);
    expect(() => parseContradictions({ score: "high", consistent: true, contradictions: [], suggestion: "" })).toThrow(/score/i);
    expect(() => parseContradictions({ score: Number.NaN, consistent: true, contradictions: [], suggestion: "" })).toThrow(/score/i);
  });
  it("throws when consistent is not a boolean", () => {
    expect(() => parseContradictions({ score: 90, consistent: "yes", contradictions: [], suggestion: "" })).toThrow(/consistent/i);
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

  it("requests a 4096-token budget (the 1024 default truncated verdicts on long excerpts)", async () => {
    let captured: { maxTokens?: number } | undefined;
    const model: ModelClient = {
      name: "mock-model",
      async generateStructured(req) {
        captured = req;
        return GOOD;
      },
    };
    await clarity02.run(artifact, { model });
    expect(captured?.maxTokens).toBe(4096);
  });

  it("never caches a degenerate verdict — the next run retries the model", async () => {
    const cache = createMemoryCache();
    // First run: truncated/garbage verdict → parse throws (runChecksAsync would drop the check).
    await expect(clarity02.run(artifact, { model: mockModel({ half: "a verdi" }), cache })).rejects.toThrow();
    // Second run with a healthy model must MISS the cache (nothing was stored) and succeed.
    const calls = { n: 0 };
    const r = await clarity02.run(artifact, { model: mockModel(GOOD, calls), cache });
    expect(calls.n).toBe(1); // cache miss → model called → no persisted false FAIL
    expect(r.status).toBe("pass");
  });

  it("judges up to 24,000 chars and discloses truncation with a 'first N chars evaluated' note", async () => {
    const rule = "- Never commit; leave staging to the user.\n";
    const longBody = rule.repeat(Math.ceil(30_000 / rule.length)); // > BODY_SLICE_CHARS
    expect(longBody.length).toBeGreaterThan(BODY_SLICE_CHARS);
    let prompt = "";
    const model: ModelClient = {
      name: "mock-model",
      async generateStructured(req) {
        prompt = req.prompt;
        return GOOD;
      },
    };
    const r = await clarity02.run(makeArtifact({ body: longBody }), { model });
    // (a) the excerpt covers 24k chars, not the old 2,500;
    expect(prompt.length).toBeGreaterThan(20_000);
    // (b) a pass over a truncated body must say so — never claim whole-file consistency.
    expect(r.status).toBe("pass");
    expect(r.evidence.some((e) => e.message?.includes("first 24,000 chars evaluated"))).toBe(true);
    // A body that fits carries no truncation note.
    const short = await clarity02.run(makeArtifact({ body: "\n# Do\n1. Read.\n" }), { model });
    expect(short.evidence.some((e) => e.message?.includes("chars evaluated"))).toBe(false);
  });
});
