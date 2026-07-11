import { describe, it, expect } from "vitest";
import { trigger05 } from "../src/checks/trigger-05-invocation-flags.js";
import { token04, REFERENCE_RATE_PER_MTOK } from "../src/checks/token-04-recurring-cost.js";
import { verify03 } from "../src/checks/verify-03-maintenance.js";
import { applicableChecks, applicableAsyncChecks } from "../src/checks/index.js";
import { audit } from "../src/index.js";
import { makeArtifact, fixture } from "./helpers.js";

describe("TRIGGER-05 invocation-flag consistency", () => {
  it("passes when neither flag is set (defaults apply)", () => {
    const r = trigger05.run(makeArtifact());
    expect(r.status).toBe("pass");
    expect(r.score).toBe(100);
  });

  it("passes on valid booleans", () => {
    const r = trigger05.run(
      makeArtifact({
        raw: "---\nname: x\ndisable-model-invocation: true\n---\nbody\n",
        frontmatter: { name: "x", description: "y", "disable-model-invocation": true },
      }),
    );
    expect(r.status).toBe("pass");
  });

  it("warns when a flag is the string \"true\" (silent misconfiguration)", () => {
    const r = trigger05.run(
      makeArtifact({
        raw: '---\nname: x\ndisable-model-invocation: "true"\n---\nbody\n',
        frontmatter: { name: "x", description: "y", "disable-model-invocation": "true" },
      }),
    );
    expect(r.status).toBe("warn");
    expect(r.evidence[0]?.message).toMatch(/not a YAML boolean/i);
    expect(r.evidence[0]?.line).toBe(3); // cites the frontmatter line
  });

  it("warns per non-boolean flag, including user-invocable", () => {
    const r = trigger05.run(
      makeArtifact({
        raw: '---\nuser-invocable: "false"\ndisable-model-invocation: 1\n---\nbody\n',
        frontmatter: { "user-invocable": "false", "disable-model-invocation": 1 },
      }),
    );
    expect(r.status).toBe("warn");
    expect(r.evidence.length).toBe(2);
  });

  it("fails when both invocation paths are closed (nobody can invoke it)", () => {
    const r = trigger05.run(
      makeArtifact({
        raw: "---\nuser-invocable: false\ndisable-model-invocation: true\n---\nbody\n",
        frontmatter: { "user-invocable": false, "disable-model-invocation": true },
      }),
    );
    expect(r.status).toBe("fail");
    expect(r.score).toBe(0);
    expect(r.evidence.some((e) => e.line === 2)).toBe(true); // user-invocable line
    expect(r.evidence.some((e) => e.line === 3)).toBe(true); // disable-model-invocation line
  });

  it("fixture end to end: dead-flags fails TRIGGER-05 with frontmatter-line evidence", () => {
    const { scorecard } = audit(fixture("dead-flags"));
    const r = scorecard.results.find((x) => x.id === "TRIGGER-05");
    expect(r?.status).toBe("fail");
    expect(r?.evidence.every((e) => e.file === "SKILL.md" && typeof e.line === "number")).toBe(true);
  });
});

describe("TOKEN-04 recurring per-invocation cost", () => {
  it("exports the named reference rate used in evidence", () => {
    expect(REFERENCE_RATE_PER_MTOK).toBe(3);
  });

  it("passes informationally below 8k tokens and labels the heuristic honestly", () => {
    const r = token04.run(makeArtifact({ raw: "line\n".repeat(100) }));
    expect(r.status).toBe("pass");
    expect(r.evidence[0]?.message).toMatch(/rough est/);
    expect(r.evidence[0]?.message).not.toMatch(/exact/);
    expect(r.evidence[0]?.message).toMatch(/per 1,000 invocations at the \$3\/Mtok reference rate/);
  });

  it("uses and labels the exact count when ctx provides it", () => {
    const r = token04.run(makeArtifact(), { accurateTokens: 1234 });
    expect(r.evidence[0]?.message).toMatch(/1,234 tokens \(exact, count_tokens\)/);
  });

  it("warns above 8k tokens — every invocation carries it — but never fails", () => {
    const r = token04.run(makeArtifact(), { accurateTokens: 9000 });
    expect(r.status).toBe("warn");
    expect(r.evidence[0]?.message).toMatch(/Every invocation carries this/);
    const huge = token04.run(makeArtifact({ raw: "abcd".repeat(200_000) }));
    expect(huge.status).toBe("warn"); // heuristic path too — never "fail"
  });
});

describe("VERIFY-03 maintenance hygiene (skills only)", () => {
  it("passes via a version frontmatter field, citing its line (good-skill fixture)", () => {
    const { scorecard } = audit(fixture("good-skill"));
    const r = scorecard.results.find((x) => x.id === "VERIFY-03");
    expect(r?.status).toBe("pass");
    expect(r?.evidence[0]?.message).toMatch(/version: 1\.0\.0/);
    expect(r?.evidence[0]?.line).toBe(4);
  });

  it("passes via a top-level CHANGELOG.md", () => {
    const r = verify03.run(makeArtifact({ files: ["CHANGELOG.md"] }));
    expect(r.status).toBe("pass");
    expect(r.evidence[0]?.message).toMatch(/CHANGELOG\.md/);
  });

  it("passes via a top-level README (bare or .md)", () => {
    expect(verify03.run(makeArtifact({ files: ["README.md"] })).status).toBe("pass");
    expect(verify03.run(makeArtifact({ files: ["readme"] })).status).toBe("pass");
  });

  // INFORMATIONAL demotion: a skill's artifact.files can't see the repo root (hosted scans
  // materialize only the skill dir), so absence must not accuse repos with root-level hygiene
  // (anthropics/skills) falsely. Nothing found → still pass/100, with an honest evidence note.
  it("a nested readme is not cited as maintenance hygiene, but the check still passes (informational)", () => {
    const r = verify03.run(makeArtifact({ files: ["docs/README.md"] }));
    expect(r.status).toBe("pass");
    expect(r.score).toBe(100);
    expect(r.evidence[0]?.message).toMatch(/repo-root hygiene isn't visible to a per-skill scan/);
  });

  it("passes informationally (never warns) when none of the three exist (dangling-ref fixture)", () => {
    const { scorecard } = audit(fixture("dangling-ref"));
    const r = scorecard.results.find((x) => x.id === "VERIFY-03");
    expect(r?.status).toBe("pass");
    expect(r?.score).toBe(100);
    expect(r?.evidence[0]?.message).toMatch(/repo-root hygiene isn't visible to a per-skill scan/);
    // Regression: the old warn dinged dangling-ref's grade for repo hygiene it couldn't see.
    expect(scorecard.grade).toBe("A");
  });
});

describe("rubric v1.2 kind scoping", () => {
  // makeArtifact pins type: "skill", so spread the kind over it explicitly.
  const artifactOf = (type: "skill" | "subagent" | "command" | "mcp" | "plugin") => ({ ...makeArtifact(), type });
  const idsFor = (type: "skill" | "subagent" | "command" | "mcp" | "plugin") =>
    applicableChecks(artifactOf(type)).map((c) => c.id);

  it("TOKEN-04 runs on skills, subagents, and commands — never mcp/plugin", () => {
    for (const kind of ["skill", "subagent", "command"] as const) {
      expect(idsFor(kind)).toContain("TOKEN-04");
    }
    for (const kind of ["mcp", "plugin"] as const) {
      expect(idsFor(kind)).not.toContain("TRIGGER-05");
      expect(idsFor(kind)).not.toContain("TOKEN-04");
      expect(idsFor(kind)).not.toContain("VERIFY-03");
    }
  });

  it("TRIGGER-05 is skills+subagents ONLY — a command must not fill Triggering from flag-absence", () => {
    expect(idsFor("skill")).toContain("TRIGGER-05");
    expect(idsFor("subagent")).toContain("TRIGGER-05");
    // Regression: registering TRIGGER-05 for commands handed every flag-less command a vacuous
    // 100/100 on the rubric's largest category (22%). Commands keep Triggering n/a instead.
    expect(idsFor("command")).not.toContain("TRIGGER-05");
  });

  it("VERIFY-03 is skills-only", () => {
    expect(idsFor("skill")).toContain("VERIFY-03");
    expect(idsFor("subagent")).not.toContain("VERIFY-03");
    expect(idsFor("command")).not.toContain("VERIFY-03");
  });

  it("CLARITY-02 applies to skills/subagents/commands, never mcp/plugin", () => {
    const asyncIds = (type: "skill" | "subagent" | "command" | "mcp" | "plugin") =>
      applicableAsyncChecks(artifactOf(type)).map((c) => c.id);
    for (const kind of ["skill", "subagent", "command"] as const) {
      expect(asyncIds(kind)).toContain("CLARITY-02");
    }
    for (const kind of ["mcp", "plugin"] as const) {
      expect(asyncIds(kind)).not.toContain("CLARITY-02");
    }
  });
});
