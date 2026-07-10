import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { audit } from "../src/index.js";
import { detectKind } from "../src/parse.js";

const here = dirname(fileURLToPath(import.meta.url));
const mcpFixture = (n: string): string => join(here, "fixtures", "artifacts", "mcp", n);

describe("MCP Phase A — .mcp.json config grading", () => {
  it("detectKind recognizes .mcp.json", () => {
    expect(detectKind(mcpFixture("clean.mcp.json"))).toBe("mcp");
  });

  it("runs ONLY whitelisted checks — no frontmatter/prose checks mis-fire on a config", () => {
    const { scorecard } = audit(mcpFixture("clean.mcp.json"), "mcp");
    const ids = scorecard.results.map((r) => r.id).sort();
    expect(ids).toEqual(["MCP-01", "MCP-02", "MCP-03", "SAFETY-01"]);
    // correctness + safety evaluated, the other four categories honestly unscored → partial
    expect(scorecard.partial).toBe(true);
  });

  it("passes a clean config (pinned npx, TLS remote, localhost http exempt)", () => {
    const { scorecard, name } = audit(mcpFixture("clean.mcp.json"), "mcp");
    expect(name).toBe("clean.mcp.json");
    for (const id of ["MCP-01", "MCP-02", "MCP-03", "SAFETY-01"]) {
      expect(scorecard.results.find((r) => r.id === id)?.status).toBe("pass");
    }
  });

  it("flags unpinned npx, plaintext remote transport, and an inline secret", () => {
    const { scorecard } = audit(mcpFixture("risky.mcp.json"), "mcp");
    expect(scorecard.results.find((r) => r.id === "MCP-02")?.status).toBe("warn"); // some-mcp-server unpinned
    expect(scorecard.results.find((r) => r.id === "MCP-03")?.status).toBe("fail"); // http:// remote
    expect(scorecard.results.find((r) => r.id === "SAFETY-01")?.status).toBe("fail"); // DB_PASSWORD inline
    const mcp03 = scorecard.results.find((r) => r.id === "MCP-03");
    expect(mcp03?.evidence[0]?.snippet).toContain("http://mcp.example.com");
  });

  it("fails MCP-01 loudly on malformed JSON", () => {
    const { scorecard } = audit(mcpFixture("broken.mcp.json"), "mcp");
    expect(scorecard.results.find((r) => r.id === "MCP-01")?.status).toBe("fail");
  });
});
