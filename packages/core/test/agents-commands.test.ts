import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, detectKind, ParseError } from "../src/parse.js";
import { audit, scanLocalDir, findLocalAgentCommandFiles } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const artifacts = join(here, "fixtures", "artifacts");
const agentFile = (n: string): string => join(artifacts, "agents", n);
const commandFile = (n: string): string => join(artifacts, "commands", n);

describe("parse + detectKind for subagents and commands", () => {
  it("detects kind from the parent directory name", () => {
    expect(detectKind(agentFile("code-reviewer.md"))).toBe("subagent");
    expect(detectKind(commandFile("deploy.md"))).toBe("command");
    expect(detectKind(join(here, "fixtures", "skills", "good-skill"))).toBe("skill");
  });

  it("parses a subagent as a single-file artifact with NO supporting files (siblings excluded)", () => {
    const a = parse(agentFile("code-reviewer.md"), "subagent");
    expect(a.type).toBe("subagent");
    expect(a.files).toEqual([]); // bad-model.md next door is NOT this artifact's file
    expect(a.frontmatter?.["name"]).toBe("code-reviewer");
  });

  it("rejects a directory as a subagent input", () => {
    expect(() => parse(artifacts, "subagent")).toThrow(ParseError);
  });
});

describe("check applicability by kind", () => {
  it("skips skill-structure checks (STRUCT-05, TOKEN-02) for single-file artifacts", () => {
    const { scorecard } = audit(agentFile("code-reviewer.md"), "subagent");
    const ids = scorecard.results.map((r) => r.id);
    expect(ids).not.toContain("STRUCT-05");
    expect(ids).not.toContain("TOKEN-02");
    expect(ids).toContain("SAFETY-01"); // universal checks still run
  });

  it("runs AGENT-01 only for subagents and CMD-01 only for commands", () => {
    const agent = audit(agentFile("code-reviewer.md"), "subagent").scorecard.results.map((r) => r.id);
    const cmd = audit(commandFile("deploy.md"), "command").scorecard.results.map((r) => r.id);
    const skill = audit(join(here, "fixtures", "skills", "good-skill")).scorecard.results.map((r) => r.id);
    expect(agent).toContain("AGENT-01");
    expect(agent).not.toContain("CMD-01");
    expect(cmd).toContain("CMD-01");
    expect(cmd).not.toContain("AGENT-01");
    expect(skill).not.toContain("AGENT-01");
    expect(skill).not.toContain("CMD-01");
  });
});

describe("agent-specific grading", () => {
  it("passes a well-formed agent (scoped tools, valid model alias)", () => {
    const { scorecard, name } = audit(agentFile("code-reviewer.md"), "subagent");
    expect(name).toBe("code-reviewer");
    const agent01 = scorecard.results.find((r) => r.id === "AGENT-01");
    const safety02 = scorecard.results.find((r) => r.id === "SAFETY-02");
    expect(agent01?.status).toBe("pass");
    expect(safety02?.status).toBe("pass"); // tools: Read, Grep, Glob — scoped
  });

  it("fails AGENT-01 on a typo'd model and warns SAFETY-02 when no tools are declared", () => {
    const { scorecard } = audit(agentFile("bad-model.md"), "subagent");
    expect(scorecard.results.find((r) => r.id === "AGENT-01")?.status).toBe("fail");
    // bad-model.md declares no tools → inherits everything → least-privilege warn
    expect(scorecard.results.find((r) => r.id === "SAFETY-02")?.status).toBe("warn");
  });
});

describe("command-specific grading", () => {
  it("passes a documented command (description + argument-hint + $1 used)", () => {
    const { scorecard, name } = audit(commandFile("deploy.md"), "command");
    expect(name).toBe("deploy"); // filename-named
    expect(scorecard.results.find((r) => r.id === "CMD-01")?.status).toBe("pass");
    expect(scorecard.results.find((r) => r.id === "STRUCT-01")?.status).toBe("pass");
  });

  it("treats missing frontmatter as valid-but-undiscoverable (pass STRUCT-01, warn STRUCT-02, warn CMD-01)", () => {
    const { scorecard } = audit(commandFile("bare.md"), "command");
    expect(scorecard.results.find((r) => r.id === "STRUCT-01")?.status).toBe("pass"); // optional for commands
    expect(scorecard.results.find((r) => r.id === "STRUCT-02")?.status).toBe("warn"); // no description
    expect(scorecard.results.find((r) => r.id === "CMD-01")?.status).toBe("warn"); // uses $ARGUMENTS, no hint
  });
});

describe("local discovery includes agents and commands", () => {
  it("findLocalAgentCommandFiles finds .md files under agents/ and commands/ dirs (incl. plugin layouts)", () => {
    const { agents, commands } = findLocalAgentCommandFiles(artifacts);
    expect(agents.length).toBe(2);
    expect(commands.length).toBe(3); // 2 top-level + the good-plugin fixture's commands/deploy.md
  });

  it("scanLocalDir grades all kinds in one batch (plugins included)", async () => {
    const { skills, errors } = await scanLocalDir(artifacts);
    expect(errors).toEqual([]);
    const types = skills.map((s) => s.artifact.type).sort();
    expect(types).toEqual(["command", "command", "command", "plugin", "plugin", "subagent", "subagent"]);
  });
});
