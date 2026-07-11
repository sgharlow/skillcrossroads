import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, auditAsync } from "../src/index.js";
import { score } from "../src/score.js";
import { applicableCategories } from "../src/checks/index.js";
import { renderBadge } from "../src/render/badge.js";
import { renderHtml } from "../src/render/html.js";
import { renderTerminal } from "../src/render/terminal.js";
import { renderMarkdown } from "../src/render/markdown.js";
import type { CheckResult, Category } from "../src/types.js";
import type { ModelClient } from "../src/llm/types.js";
import { fixture } from "./helpers.js";

const here = dirname(fileURLToPath(import.meta.url));
const cmdFile = join(here, "fixtures", "artifacts", "commands", "deploy.md");
const mcpFile = join(here, "fixtures", "artifacts", "mcp", "clean.mcp.json");

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

const mkResult = (id: string, category: Category, s = 90): CheckResult => ({
  id,
  category,
  title: id,
  weight: 1,
  status: "pass",
  score: s,
  evidence: [{ file: "x", message: "synthetic" }],
});

describe("applicableCategories — what CAN ever score for a kind", () => {
  it("skills and subagents can score all six categories", () => {
    expect(applicableCategories("skill").size).toBe(6);
    expect(applicableCategories("subagent").size).toBe(6);
  });

  it("commands can never score triggering (explicitly invoked), but can score the other five", () => {
    const cats = applicableCategories("command");
    expect(cats.has("triggering")).toBe(false);
    expect(cats.size).toBe(5);
  });

  it("mcp configs can score correctness+safety statically and triggering+clarity via --mcp-live; never token/verifiability", () => {
    const cats = applicableCategories("mcp");
    expect([...cats].sort()).toEqual(["clarity", "correctness", "safety", "triggering"]);
  });
});

describe("LIVE_MCP_CATEGORIES stays in sync with the real gradeMcpLive output", () => {
  it("every category a live MCPT check can emit is applicable for mcp (drift fails here)", async () => {
    const { gradeMcpLive } = await import("../src/mcp-live.js");
    // Introspection data engineered to make all three MCPT checks emit results.
    const results = gradeMcpLive(".mcp.json", [
      { server: "dead", error: "spawn failed" },
      {
        server: "up",
        tools: [{ name: "t", description: "short", inputSchema: { type: "object", properties: { a: {} } } }],
      },
    ]);
    expect(results.map((r) => r.id).sort()).toEqual(["MCPT-01", "MCPT-02", "MCPT-03"]);
    const mcpCats = applicableCategories("mcp");
    for (const r of results) expect(mcpCats.has(r.category), `${r.id} → ${r.category}`).toBe(true);
  });
});

describe("kind-aware partial — asterisk only when applicable coverage is incomplete", () => {
  it("a KEYED command scan is a full grade (no asterisk): every applicable category scored", async () => {
    const { scorecard } = await auditAsync(cmdFile, { model: stub }, "command");
    expect(scorecard.partial).toBe(false);
    const trig = scorecard.categories.find((c) => c.key === "triggering")!;
    expect(trig.applicable).toBe(false);
    expect(trig.evaluated).toBe(false);
    expect(renderBadge(scorecard)).not.toContain("*");
  });

  it("a KEYLESS command scan stays honestly partial (verifiability could score with a key)", () => {
    const { scorecard } = audit(cmdFile, "command");
    expect(scorecard.partial).toBe(true);
    const ver = scorecard.categories.find((c) => c.key === "verifiability")!;
    expect(ver.applicable).toBe(true);
    expect(ver.evaluated).toBe(false);
    expect(renderBadge(scorecard)).toContain("*");
  });

  it("a static mcp scan is partial (live checks could add triggering/clarity); token/verifiability are n/a, not holes", () => {
    const { scorecard } = audit(mcpFile, "mcp");
    expect(scorecard.partial).toBe(true);
    expect(scorecard.categories.find((c) => c.key === "token")!.applicable).toBe(false);
    expect(scorecard.categories.find((c) => c.key === "verifiability")!.applicable).toBe(false);
    expect(scorecard.categories.find((c) => c.key === "triggering")!.applicable).toBe(true);
  });

  it("an mcp scan WITH live results covering triggering+clarity becomes a full grade", () => {
    const { scorecard } = audit(mcpFile, "mcp");
    const withLive = score(
      [...scorecard.results, mkResult("MCPT-02", "triggering"), mkResult("MCPT-03", "clarity")],
      "mcp",
    );
    expect(withLive.partial).toBe(false);
  });

  it("keyless SKILL behavior is unchanged: all six applicable and scored, not partial", () => {
    const { scorecard } = audit(fixture("good-skill"));
    expect(scorecard.partial).toBe(false);
    expect(scorecard.categories.every((c) => c.applicable)).toBe(true);
  });

  it("score() without a kind keeps the legacy semantics (every category applicable)", () => {
    const card = score([mkResult("STRUCT-01", "correctness")]);
    expect(card.partial).toBe(true);
    expect(card.categories.every((c) => c.applicable)).toBe(true);
  });
});

describe("renderers label structural n/a differently from unscored-but-possible", () => {
  it("html/terminal/markdown say n/a for a command's triggering row, not 'not yet scored'", async () => {
    const { scorecard, name } = await auditAsync(cmdFile, { model: stub }, "command");
    const html = renderHtml(scorecard, { name });
    expect(html).toContain("n/a for this artifact kind");
    expect(html).not.toContain("not yet scored");
    const term = renderTerminal(scorecard, { name });
    expect(term).toContain("n/a for this kind");
    expect(term).not.toContain("not yet scored");
    const md = renderMarkdown(scorecard, { name });
    expect(md).toContain("_n/a_");
    expect(md).not.toContain("_not scored_");
  });

  it("a keyless command still labels verifiability as unscored (a real hole), triggering as n/a", () => {
    const { scorecard, name } = audit(cmdFile, "command");
    const html = renderHtml(scorecard, { name });
    expect(html).toContain("n/a for this artifact kind");
    expect(html).toContain("not yet scored");
  });
});
