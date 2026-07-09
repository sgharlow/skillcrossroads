import { describe, it, expect } from "vitest";
import { token01 } from "../src/checks/token-01-budget.js";
import { token02 } from "../src/checks/token-02-disclosure.js";
import { token03 } from "../src/checks/token-03-desc-budget.js";
import { runChecksAsync } from "../src/checks/index.js";
import type { TokenCounter } from "../src/llm/tokens.js";
import { makeArtifact } from "./helpers.js";

describe("TOKEN-01 exact vs estimate", () => {
  it("labels the count as a rough estimate without a token counter", () => {
    const r = token01.run(makeArtifact({ raw: "line\n".repeat(50) }));
    expect(r.evidence[0]?.message).toMatch(/rough est/);
  });
  it("uses and labels the exact count when provided in ctx", () => {
    const r = token01.run(makeArtifact({ raw: "line\n".repeat(50) }), { accurateTokens: 1234 });
    expect(r.evidence[0]?.message).toMatch(/1,234 tokens \(exact/);
  });
});

describe("TOKEN-02 progressive disclosure", () => {
  it("passes a lean SKILL.md", () => {
    expect(token02.run(makeArtifact({ body: "short\n".repeat(20) })).status).toBe("pass");
  });
  it("passes a large SKILL.md that has supporting files", () => {
    const r = token02.run(makeArtifact({ body: "x\n".repeat(300), files: ["references/a.md"] }));
    expect(r.status).toBe("pass");
  });
  it("warns on a large SKILL.md with no supporting files", () => {
    const r = token02.run(makeArtifact({ body: "x\n".repeat(300), files: [] }));
    expect(r.status).toBe("warn");
    expect(r.fix).toMatch(/supporting files/);
  });
});

describe("TOKEN-03 description budget footprint", () => {
  const withDesc = (d: string) => makeArtifact({ frontmatter: { name: "x", description: d } });
  it("passes a lean description", () => {
    expect(token03.run(withDesc("Do the thing when the user asks.")).status).toBe("pass");
  });
  it("warns on a heavy description", () => {
    expect(token03.run(withDesc("x".repeat(1100))).status).toBe("warn");
  });
  it("fails a description over the listing cap", () => {
    expect(token03.run(withDesc("x".repeat(1600))).status).toBe("fail");
  });
  it("passes when there is no description", () => {
    expect(token03.run(makeArtifact({ frontmatter: { name: "x" } })).status).toBe("pass");
  });
});

describe("runChecksAsync token counting", () => {
  it("precomputes the exact count once and TOKEN-01 reports it", async () => {
    const calls = { n: 0 };
    const counter: TokenCounter = {
      accurate: true,
      count: () => {
        calls.n++;
        return Promise.resolve(4242);
      },
    };
    const results = await runChecksAsync(makeArtifact({ raw: "hello\n".repeat(10) }), { tokenCounter: counter });
    const token = results.find((r) => r.id === "TOKEN-01");
    expect(calls.n).toBe(1); // counted once, not per check
    expect(token?.evidence[0]?.message).toMatch(/4,242 tokens \(exact/);
  });

  it("falls back to the estimate when the counter throws (reported via onError)", async () => {
    const errors: string[] = [];
    const counter: TokenCounter = {
      accurate: true,
      count: () => Promise.reject(new Error("429")),
    };
    const results = await runChecksAsync(makeArtifact(), {
      tokenCounter: counter,
      onError: (id) => errors.push(id),
    });
    expect(errors).toContain("TOKEN-01");
    expect(results.find((r) => r.id === "TOKEN-01")?.evidence[0]?.message).toMatch(/rough est/);
  });
});
