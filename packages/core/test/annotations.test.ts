import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderAnnotations } from "../src/render/annotations.js";
import { audit } from "../src/index.js";
import { fixture } from "./helpers.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("renderAnnotations (GitHub workflow commands)", () => {
  it("emits ::error for fails and ::warning for warns, anchored to file:line under the path prefix", () => {
    const res = audit(fixture("dangling-ref")); // STRUCT-05 fail with SKILL.md:10 evidence
    const lines = renderAnnotations([{ repoPath: "dangling-ref", name: res.name, scorecard: res.scorecard }], "skills");
    const err = lines.find((l) => l.includes("STRUCT-05"));
    expect(err).toBeDefined();
    expect(err).toMatch(/^::error file=skills\/dangling-ref\/SKILL\.md,line=\d+/);
    expect(err).toContain("Skill Crossroads STRUCT-05");
  });

  it("emits nothing for a clean scan", () => {
    const res = audit(fixture("good-skill"));
    expect(renderAnnotations([{ repoPath: ".", name: res.name, scorecard: res.scorecard }])).toEqual([]);
  });

  it("does not double the filename for single-file artifacts (repoPath already IS the file)", () => {
    const agentPath = join(here, "fixtures", "artifacts", "agents", "bad-model.md");
    const res = audit(agentPath, "subagent"); // AGENT-01 fail
    const lines = renderAnnotations(
      [{ repoPath: "agents/bad-model.md", name: res.name, scorecard: res.scorecard }],
      ".claude",
    );
    const line = lines.find((l) => l.includes("AGENT-01"));
    expect(line).toContain("file=.claude/agents/bad-model.md,");
    expect(line).not.toContain("bad-model.md/bad-model.md");
  });

  it("escapes newlines and commas per workflow-command rules", () => {
    const res = audit(fixture("dangling-ref"));
    const lines = renderAnnotations([{ repoPath: "x", name: "a,b\nc", scorecard: res.scorecard }]);
    for (const l of lines) {
      expect(l).not.toMatch(/\n/);
      // the message segment (after ::) must have newlines encoded
      expect(l).toContain("%0A");
    }
  });
});
