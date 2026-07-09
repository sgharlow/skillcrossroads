import { describe, it, expect } from "vitest";
import { safety02, parseAllowedTools } from "../src/checks/safety-02-permissions.js";
import { safety03 } from "../src/checks/safety-03-autoinvoke.js";
import { safety04 } from "../src/checks/safety-04-injection.js";
import { audit } from "../src/index.js";
import { makeArtifact, fixture } from "./helpers.js";

describe("parseAllowedTools", () => {
  it("splits strings and passes arrays through", () => {
    expect(parseAllowedTools("Read, Bash(git status)")).toEqual(["Read", "Bash(git status)"]);
    expect(parseAllowedTools(["Read", "Write"])).toEqual(["Read", "Write"]);
    expect(parseAllowedTools(undefined)).toEqual([]);
  });
});

describe("SAFETY-02 allowed-tools least-privilege", () => {
  it("passes when no allowed-tools declared", () => {
    expect(safety02.run(makeArtifact({ frontmatter: { name: "x", description: "y" } })).status).toBe("pass");
  });
  it("fails on a wildcard grant", () => {
    const r = safety02.run(makeArtifact({ frontmatter: { "allowed-tools": "*" } }));
    expect(r.status).toBe("fail");
    expect(r.evidence[0]?.message).toMatch(/wildcard/i);
  });
  it("warns on unrestricted Bash", () => {
    expect(safety02.run(makeArtifact({ frontmatter: { "allowed-tools": "Read, Bash" } })).status).toBe("warn");
  });
  it("passes on scoped grants", () => {
    expect(
      safety02.run(makeArtifact({ frontmatter: { "allowed-tools": "Read, Bash(git status)" } })).status,
    ).toBe("pass");
  });
});

describe("SAFETY-03 destructive auto-invocation", () => {
  it("warns on a destructive, auto-invocable skill", () => {
    const r = safety03.run(makeArtifact({ frontmatter: { name: "deployer", description: "Deploy to production." } }));
    expect(r.status).toBe("warn");
    expect(r.fix).toMatch(/disable-model-invocation/);
  });
  it("passes when model invocation is disabled", () => {
    const r = safety03.run(
      makeArtifact({ frontmatter: { name: "deployer", description: "Deploy to production.", "disable-model-invocation": true } }),
    );
    expect(r.status).toBe("pass");
  });
  it("passes a non-destructive skill", () => {
    expect(safety03.run(makeArtifact({ frontmatter: { name: "notes", description: "Summarize notes." } })).status).toBe("pass");
  });
});

describe("SAFETY-04 shell-injection in `!` blocks", () => {
  it("fails when user args are interpolated into a shell command", () => {
    const raw = "Run !`grep $ARGUMENTS ./src` to search.\n";
    const r = safety04.run(makeArtifact({ raw }));
    expect(r.status).toBe("fail");
    expect(r.evidence[0]?.line).toBe(1);
  });
  it("passes a dynamic block without interpolation", () => {
    expect(safety04.run(makeArtifact({ raw: "Status: !`git status`.\n" })).status).toBe("pass");
  });
  it("passes when there are no dynamic blocks", () => {
    expect(safety04.run(makeArtifact({ raw: "Just prose with $ARGUMENTS mentioned.\n" })).status).toBe("pass");
  });
});

describe("safety pack — end to end", () => {
  it("detects all four planted issues in the vulnerable fixture", () => {
    const { scorecard } = audit(fixture("vulnerable"));
    const status = (id: string) => scorecard.results.find((r) => r.id === id)?.status;
    expect(status("SAFETY-01")).toBe("fail"); // AWS key
    expect(status("SAFETY-02")).toBe("fail"); // allowed-tools: "*"
    expect(status("SAFETY-03")).toBe("warn"); // deploy/delete, auto-invocable
    expect(status("SAFETY-04")).toBe("fail"); // $ARGUMENTS in !`...`
  });

  it("has zero false-positives on the clean control skill", () => {
    const { scorecard } = audit(fixture("good-skill"));
    for (const id of ["SAFETY-01", "SAFETY-02", "SAFETY-03", "SAFETY-04"]) {
      expect(scorecard.results.find((r) => r.id === id)?.status).toBe("pass");
    }
    // control still grades A+ overall
    expect(scorecard.grade).toBe("A+");
  });
});
