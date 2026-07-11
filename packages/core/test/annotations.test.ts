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

  // Single-target scans: the scan root IS the artifact, so pathPrefix (the CLI's args.path)
  // already contains the repoPath (basename fallback) and/or the evidence file. Segment-aware
  // dedup must collapse them — the QA-found doubled-path bug.
  it("does not double the dir name when the scan target is the skill dir itself (repoPath = basename fallback)", () => {
    const res = audit(fixture("vulnerable"));
    const lines = renderAnnotations(
      [{ repoPath: "vulnerable", name: res.name, scorecard: res.scorecard }],
      "packages/core/test/fixtures/skills/vulnerable",
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).toContain("file=packages/core/test/fixtures/skills/vulnerable/SKILL.md,");
      expect(l).not.toContain("vulnerable/vulnerable");
    }
  });

  it("does not double the filename when the scan target is a single command file (repoPath '.')", () => {
    const cmdPath = join(here, "fixtures", "artifacts", "commands", "deploy.md");
    const res = audit(cmdPath, "command");
    const lines = renderAnnotations(
      [{ repoPath: ".", name: res.name, scorecard: res.scorecard }],
      "packages/core/test/fixtures/artifacts/commands/deploy.md",
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).toContain("file=packages/core/test/fixtures/artifacts/commands/deploy.md,");
      expect(l).not.toContain("deploy.md/deploy.md");
    }
  });

  it("does not double the filename when the scan target is a single .mcp.json file (repoPath '.')", () => {
    const mcpPath = join(here, "fixtures", "artifacts", "mcp", "risky.mcp.json");
    const res = audit(mcpPath, "mcp");
    const lines = renderAnnotations(
      [{ repoPath: ".", name: res.name, scorecard: res.scorecard }],
      "packages/core/test/fixtures/artifacts/mcp/risky.mcp.json",
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).toContain("file=packages/core/test/fixtures/artifacts/mcp/risky.mcp.json,");
      expect(l).not.toContain("risky.mcp.json/risky.mcp.json");
    }
  });

  it("keeps the batch (parent-dir) form byte-identical: prefix + repoPath + evidence file all join", () => {
    const res = audit(fixture("vulnerable"));
    const lines = renderAnnotations(
      [{ repoPath: "skills/vulnerable", name: res.name, scorecard: res.scorecard }],
      "packages/core/test/fixtures",
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).toContain("file=packages/core/test/fixtures/skills/vulnerable/SKILL.md,");
    }
  });

  it("dedups WHOLE segments only — a same-name non-suffix prefix must not swallow repoPath", () => {
    const res = audit(fixture("vulnerable"));
    const lines = renderAnnotations(
      [{ repoPath: "vulnerable", name: res.name, scorecard: res.scorecard }],
      "a/vulnerable-old",
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).toContain("file=a/vulnerable-old/vulnerable/SKILL.md,");
    }
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
