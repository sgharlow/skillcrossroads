import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, auditAsync } from "../src/index.js";
import { renderMarkdown } from "../src/render/markdown.js";
import { renderTerminal } from "../src/render/terminal.js";
import { renderHtml } from "../src/render/html.js";
import { applicableAsyncChecks } from "../src/checks/index.js";
import { parse } from "../src/parse.js";
import type { ModelClient } from "../src/llm/types.js";
import { fixture } from "./helpers.js";

const here = dirname(fileURLToPath(import.meta.url));
const agentFile = join(here, "fixtures", "artifacts", "agents", "code-reviewer.md");
const cmdFile = join(here, "fixtures", "artifacts", "commands", "deploy.md");
const mcpFile = join(here, "fixtures", "artifacts", "mcp", "clean.mcp.json");

/** A stub model that returns plausible verdicts for any structured request. */
const stub: ModelClient = {
  name: "stub",
  generateStructured: (req) => {
    const schema = JSON.stringify(req);
    if (schema.includes("wouldReliablyTrigger"))
      return Promise.resolve({ score: 85, wouldReliablyTrigger: true, issues: [], suggestedTriggerPhrases: [] });
    if (schema.includes("verifies")) return Promise.resolve({ score: 90, verifies: true, finding: "ok", suggestion: "" });
    return Promise.resolve({ score: 88, statesConstraints: true, gaps: [], suggestion: "" });
  },
};

describe("QA fix 1 — LLM checks are kind-scoped (never run where they can't apply)", () => {
  it("a keyed .mcp.json scan equals the keyless scan (no prose checks on a JSON config)", async () => {
    const keyless = audit(mcpFile, "mcp").scorecard;
    const keyed = (await auditAsync(mcpFile, { model: stub }, "mcp")).scorecard;
    expect(keyed.overall).toBe(keyless.overall);
    expect(keyed.results.map((r) => r.id)).not.toContain("TRIGGER-01");
    expect(keyed.results.map((r) => r.id)).not.toContain("VERIFY-04");
    expect(keyed.results.map((r) => r.id)).not.toContain("CLARITY-05");
  });

  it("TRIGGER-01 is excluded for commands (explicitly invoked), kept for skills and agents", () => {
    const ids = (p: string, t: "skill" | "subagent" | "command") =>
      applicableAsyncChecks(parse(p, t)).map((c) => c.id);
    expect(ids(fixture("good-skill"), "skill")).toContain("TRIGGER-01");
    expect(ids(agentFile, "subagent")).toContain("TRIGGER-01");
    expect(ids(cmdFile, "command")).not.toContain("TRIGGER-01");
    expect(ids(cmdFile, "command")).toEqual(expect.arrayContaining(["VERIFY-04", "CLARITY-05"]));
  });
});

describe("QA fix 2 — percentile renders for SKILLS only (the sample is 214 skills)", () => {
  it("a keyed full-rubric AGENT card never shows the percentile in any renderer", async () => {
    const { scorecard, name } = await auditAsync(agentFile, { model: stub }, "subagent");
    expect(scorecard.partial).toBe(false); // full rubric — the old guard would have leaked
    expect(scorecard.kind).toBe("subagent");
    expect(renderMarkdown(scorecard, { name })).not.toContain("scores higher than");
    expect(renderTerminal(scorecard, { name })).not.toContain("scores higher than");
    expect(renderHtml(scorecard, { name })).not.toContain("scores higher than");
  });

  it("a keyless full-rubric SKILL card still shows it (and carries kind)", () => {
    const { scorecard, name } = audit(fixture("good-skill"));
    expect(scorecard.kind).toBe("skill");
    expect(scorecard.partial).toBe(false);
    expect(renderMarkdown(scorecard, { name })).toContain("scores higher than");
  });
});
