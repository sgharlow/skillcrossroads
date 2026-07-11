import { describe, it, expect } from "vitest";
import { audit } from "../src/index.js";
import { renderTerminal } from "../src/render/terminal.js";
import { fixture } from "./helpers.js";

describe("audit — end to end on fixtures", () => {
  it("grades a clean skill A+ with all checks passing", () => {
    const { scorecard, name } = audit(fixture("good-skill"));
    expect(name).toBe("meeting-notes");
    expect(scorecard.grade).toBe("A+");
    expect(scorecard.overall).toBe(100);
    expect(scorecard.results.every((r) => r.status === "pass")).toBe(true);
    // Rubric v1.1: deterministic checks cover all six categories for skills → full grade.
    expect(scorecard.partial).toBe(false);
  });

  it("catches a dangling supporting-file reference", () => {
    const { scorecard } = audit(fixture("dangling-ref"));
    const struct05 = scorecard.results.find((r) => r.id === "STRUCT-05");
    expect(struct05?.status).toBe("fail");
    expect(struct05?.evidence.length).toBe(2); // converter.md + style.md
    const correctness = scorecard.categories.find((c) => c.key === "correctness");
    expect(correctness?.failCount).toBe(1);
    // v1.2: VERIFY-03 warns (no version/changelog/readme in this fixture), nudging A → A−.
    expect(scorecard.grade).toBe("A−");
  });

  it("catches hardcoded secrets in the skill and its supporting files", () => {
    const { scorecard } = audit(fixture("has-secrets"));
    const safety = scorecard.results.find((r) => r.id === "SAFETY-01");
    expect(safety?.status).toBe("fail");
    // one finding in SKILL.md (AWS key), one in config.txt (assigned credential)
    expect(safety?.evidence.length).toBe(2);
    const files = safety?.evidence.map((e) => e.file);
    expect(files).toContain("config.txt");
  });

  it("fails structure checks for a file with no frontmatter", () => {
    const { scorecard } = audit(fixture("no-frontmatter"));
    expect(scorecard.results.find((r) => r.id === "STRUCT-01")?.status).toBe("fail");
    expect(scorecard.results.find((r) => r.id === "STRUCT-02")?.status).toBe("fail");
  });

  it("does not crash on any fixture", () => {
    for (const f of ["good-skill", "dangling-ref", "has-secrets", "no-frontmatter"]) {
      expect(() => audit(fixture(f))).not.toThrow();
    }
  });
});

describe("renderTerminal", () => {
  it("renders the scorecard box, categories, and top fixes", () => {
    const { scorecard, name } = audit(fixture("dangling-ref"));
    const out = renderTerminal(scorecard, { name });
    expect(out).toContain("SKILL CROSSROADS SCORECARD");
    expect(out).toContain("Overall:");
    expect(out).toContain("Correctness & Structure");
    expect(out).not.toContain("not yet scored"); // v1.1: skills score all six categories keyless
    expect(out).toContain("TOP FIXES");
    expect(out).toContain("STRUCT-05");
  });

  it("reports a clean scan for a perfect skill", () => {
    const { scorecard, name } = audit(fixture("good-skill"));
    const out = renderTerminal(scorecard, { name });
    expect(out).toContain("Clean scan");
  });

  it("labels a deterministic scan honestly (v1.1 regression: triggering scores without a model)", () => {
    const { scorecard, name } = audit(fixture("good-skill"));
    const out = renderTerminal(scorecard, { name });
    expect(out).toContain("deterministic");
    expect(out).not.toContain("LLM-assisted");
  });
});
