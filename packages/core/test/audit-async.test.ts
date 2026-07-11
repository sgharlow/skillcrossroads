import { describe, it, expect } from "vitest";
import { audit, auditAsync } from "../src/index.js";
import type { ModelClient } from "../src/llm/types.js";
import { fixture } from "./helpers.js";

const goodVerdict = {
  score: 86,
  wouldReliablyTrigger: true,
  issues: [],
  suggestedTriggerPhrases: [],
};

function mockModel(impl: () => Promise<unknown>): ModelClient {
  return { name: "mock-model", generateStructured: impl };
}

describe("auditAsync", () => {
  it("evaluates the triggering category when a model is supplied", async () => {
    const { scorecard } = await auditAsync(fixture("good-skill"), {
      model: mockModel(() => Promise.resolve(goodVerdict)),
    });
    const triggering = scorecard.categories.find((c) => c.key === "triggering");
    expect(triggering?.evaluated).toBe(true);
    // v1.2: TRIGGER-01 (86, w1) blends with deterministic TRIGGER-02/03/05 (100, w0.5 each) → 94.4.
    expect(triggering?.score).toBe(94.4);
    expect(scorecard.results.some((r) => r.id === "TRIGGER-01")).toBe(true);
  });

  it("is deterministic-only (equals audit) when no model is supplied", async () => {
    const asyncCard = (await auditAsync(fixture("good-skill"), {})).scorecard;
    const syncCard = audit(fixture("good-skill")).scorecard;
    expect(asyncCard.overall).toBe(syncCard.overall);
    // v1.1: triggering scores deterministically (TRIGGER-02/03) even without a model.
    expect(asyncCard.categories.find((c) => c.key === "triggering")?.evaluated).toBe(true);
  });

  it("drops the async check and reports via onError when the model fails", async () => {
    const errors: string[] = [];
    const { scorecard } = await auditAsync(
      fixture("good-skill"),
      {
        model: mockModel(() => Promise.reject(new Error("boom"))),
        onError: (id) => errors.push(id),
      },
    );
    // all LLM checks fail and are dropped
    expect(errors).toContain("TRIGGER-01");
    expect(errors).toContain("VERIFY-04");
    expect(errors).toContain("CLARITY-05");
    expect(errors).toContain("CLARITY-02");
    // v1.1: the dropped LLM checks leave the deterministic checks scoring both categories,
    // so the grade equals a plain deterministic audit — errors still never tank the grade.
    expect(scorecard.categories.find((c) => c.key === "triggering")?.evaluated).toBe(true);
    expect(scorecard.categories.find((c) => c.key === "verifiability")?.evaluated).toBe(true);
    expect(scorecard.overall).toBe(audit(fixture("good-skill")).scorecard.overall);
  });

  it("evaluates the verifiability category (all six with a model)", async () => {
    const { scorecard } = await auditAsync(fixture("good-skill"), {
      model: mockModel(() =>
        Promise.resolve({ score: 90, verifies: true, finding: "runs a check", suggestion: "" }),
      ),
    });
    expect(scorecard.categories.find((c) => c.key === "verifiability")?.evaluated).toBe(true);
    expect(scorecard.results.some((r) => r.id === "VERIFY-04")).toBe(true);
    // triggering + verifiability now both scored → full rubric, not partial
    expect(scorecard.partial).toBe(false);
  });
});
