import { describe, it, expect } from "vitest";
import { suggestFixes, parseSuggestions } from "../src/suggest.js";
import { score } from "../src/score.js";
import { createMemoryCache } from "../src/llm/cache.js";
import { makeArtifact } from "./helpers.js";
import type { ModelClient, StructuredRequest } from "../src/llm/types.js";
import type { CheckResult, CheckStatus } from "../src/types.js";

function result(id: string, status: CheckStatus, scoreN: number): CheckResult {
  return {
    id,
    category: "clarity",
    title: id,
    weight: 1,
    status,
    score: scoreN,
    evidence: [{ file: "SKILL.md", line: 1, message: `finding for ${id}` }],
  };
}

/** A stub ModelClient that returns a fixed structured payload and records each request. */
function stubModel(payload: unknown, calls: StructuredRequest[] = []): ModelClient {
  return {
    name: "stub-model",
    generateStructured: (req) => {
      calls.push(req);
      return Promise.resolve(payload);
    },
  };
}

const artifact = makeArtifact();

describe("suggestFixes", () => {
  it("ranks fails first and respects max", async () => {
    const card = score([
      result("WARN-01", "warn", 40),
      result("FAIL-01", "fail", 10),
      result("PASS-01", "pass", 100),
    ]);
    const calls: StructuredRequest[] = [];
    const model = stubModel(
      {
        suggestions: [
          { checkId: "FAIL-01", summary: "fix the fail" },
          { checkId: "WARN-01", summary: "fix the warn" },
        ],
      },
      calls,
    );
    const out = await suggestFixes(artifact, card, { model }, { max: 1 });
    // max=1 keeps only the worst finding — the fail outranks the warn, so the
    // model's WARN-01 suggestion is outside the allowed set and filtered.
    expect(out).toHaveLength(1);
    expect(out[0]?.checkId).toBe("FAIL-01");
    // The prompt is scoped to the top-N findings only.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.prompt).toContain("FAIL-01");
    expect(calls[0]?.prompt).not.toContain("WARN-01");
    // 8192-token generations outlast the client's 30 s verdict timeout — the request must
    // carry its own budget-matched timeout.
    expect(calls[0]?.maxTokens).toBe(8192);
    expect(calls[0]?.timeoutMs).toBe(120_000);
  });

  it("filters model-invented checkIds via parseSuggestions", async () => {
    const card = score([result("FAIL-01", "fail", 10)]);
    const model = stubModel({
      suggestions: [
        { checkId: "MADE-UP-99", summary: "the model may not invent findings" },
        { checkId: "FAIL-01", summary: "real", current: "old text", proposed: "new text" },
      ],
    });
    const out = await suggestFixes(artifact, card, { model });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ checkId: "FAIL-01", current: "old text", proposed: "new text" });
  });

  it("caches by content hash — the second call never hits the model", async () => {
    const card = score([result("FAIL-01", "fail", 10)]);
    let invocations = 0;
    const model: ModelClient = {
      name: "stub-model",
      generateStructured: () => {
        invocations++;
        return Promise.resolve({ suggestions: [{ checkId: "FAIL-01", summary: "cached fix" }] });
      },
    };
    const cache = createMemoryCache();
    const first = await suggestFixes(artifact, card, { model, cache });
    const second = await suggestFixes(artifact, card, { model, cache });
    expect(invocations).toBe(1);
    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
  });

  it("returns [] without a model (honest skip, like the LLM checks)", async () => {
    const card = score([result("FAIL-01", "fail", 10)]);
    expect(await suggestFixes(artifact, card, {})).toEqual([]);
  });

  it("returns [] and reports via ctx.onError when the model throws", async () => {
    const card = score([result("FAIL-01", "fail", 10)]);
    const errors: string[] = [];
    const model: ModelClient = {
      name: "stub-model",
      generateStructured: () => Promise.reject(new Error("boom")),
    };
    const out = await suggestFixes(artifact, card, {
      model,
      onError: (id) => errors.push(id),
    });
    expect(out).toEqual([]);
    expect(errors).toContain("SUGGEST");
  });

  it("returns [] on a clean scan without calling the model", async () => {
    const card = score([result("PASS-01", "pass", 100)]);
    const calls: StructuredRequest[] = [];
    const out = await suggestFixes(artifact, card, { model: stubModel({ suggestions: [] }, calls) });
    expect(out).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("parseSuggestions", () => {
  it("clamps untrusted output: drops malformed items and unknown ids, truncates steps", () => {
    const allowed = new Set(["FAIL-01"]);
    const out = parseSuggestions(
      {
        suggestions: [
          { checkId: "FAIL-01", summary: "ok", steps: ["a", 42, "b"] },
          { checkId: "NOT-ALLOWED", summary: "dropped" },
          { checkId: "FAIL-01" }, // no summary — dropped
          "garbage",
        ],
      },
      allowed,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.steps).toEqual(["a", "b"]);
  });

  it("returns [] for non-object payloads", () => {
    expect(parseSuggestions(null, new Set())).toEqual([]);
    expect(parseSuggestions({ suggestions: "nope" }, new Set())).toEqual([]);
  });
});
