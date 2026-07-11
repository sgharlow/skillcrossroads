import { describe, it, expect } from "vitest";
import { CHECKS, ASYNC_CHECKS, allCheckDocs } from "../src/checks/index.js";
import { LIVE_MCP_CHECK_META } from "../src/mcp-live.js";
import { checkDocsUrl, DEFAULT_SITE_URL } from "../src/badge-embed.js";
import { audit } from "../src/index.js";
import { renderMarkdown } from "../src/render/markdown.js";
import { renderHtml } from "../src/render/html.js";
import { renderTerminal } from "../src/render/terminal.js";
import { renderAnnotations } from "../src/render/annotations.js";
import { fixture } from "./helpers.js";

describe("check docs — every check ships its reference page", () => {
  it("every deterministic, LLM, and live check has substantive why + fix docs", () => {
    for (const c of [...CHECKS, ...ASYNC_CHECKS, ...LIVE_MCP_CHECK_META]) {
      expect(c.docs.why.length, `${c.id} docs.why`).toBeGreaterThan(40);
      expect(c.docs.fix.length, `${c.id} docs.fix`).toBeGreaterThan(30);
      // No placeholder text sneaking onto public pages.
      expect(c.docs.why.toLowerCase()).not.toMatch(/todo|tbd|placeholder/);
      expect(c.docs.fix.toLowerCase()).not.toMatch(/todo|tbd|placeholder/);
    }
  });

  it("allCheckDocs covers every registered check with unique ids", () => {
    const entries = allCheckDocs();
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(entries.length).toBe(CHECKS.length + ASYNC_CHECKS.length + LIVE_MCP_CHECK_META.length);
    expect(ids).toEqual(expect.arrayContaining(["STRUCT-01", "TRIGGER-01", "MCP-02", "MCPT-02"]));
  });

  it("checkDocsUrl builds the canonical lowercase page URL", () => {
    expect(checkDocsUrl("TRIGGER-01")).toBe(`${DEFAULT_SITE_URL}/docs/checks/trigger-01`);
    expect(checkDocsUrl("SAFETY-01", "https://example.com/")).toBe("https://example.com/docs/checks/safety-01");
  });
});

describe("findings link to their check's docs page on every surface", () => {
  // A fixture that trips checks, so at least one finding carries a docs link.
  const { scorecard, name, artifact } = audit(fixture("no-frontmatter"));

  it("markdown links the check id", () => {
    expect(renderMarkdown(scorecard, { name })).toContain(`](${DEFAULT_SITE_URL}/docs/checks/`);
  });

  it("html links the check id", () => {
    expect(renderHtml(scorecard, { name })).toContain(`href="${DEFAULT_SITE_URL}/docs/checks/`);
  });

  it("terminal prints a Docs: line per fix", () => {
    expect(renderTerminal(scorecard, { name })).toContain(`Docs: ${DEFAULT_SITE_URL}/docs/checks/`);
  });

  it("annotations append the docs URL", () => {
    const lines = renderAnnotations([{ repoPath: ".", name, scorecard }]);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toContain(`${DEFAULT_SITE_URL}/docs/checks/`);
  });

  it("fixture sanity: the bad skill actually has non-pass findings", () => {
    expect(artifact.type).toBe("skill");
    expect(scorecard.results.some((r) => r.status !== "pass")).toBe(true);
  });
});
