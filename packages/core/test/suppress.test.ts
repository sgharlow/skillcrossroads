import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseConfig, loadConfig, applySuppressions, ConfigError, CONFIG_FILENAME } from "../src/suppress.js";
import { audit } from "../src/index.js";
import { renderTerminal } from "../src/render/terminal.js";
import { renderMarkdown } from "../src/render/markdown.js";
import { fixture } from "./helpers.js";

describe("parseConfig", () => {
  it("parses suppressions (id normalized upper-case) and minGrade", () => {
    const c = parseConfig(`{"ignore":[{"id":"token-02","reason":"single-file skill by design"}],"minGrade":"B"}`);
    expect(c.suppressions).toEqual([{ id: "TOKEN-02", reason: "single-file skill by design" }]);
    expect(c.minGrade).toBe("B");
  });

  it("rejects a suppression without a reason (unexplained holes are not allowed)", () => {
    expect(() => parseConfig(`{"ignore":[{"id":"TOKEN-02"}]}`)).toThrow(ConfigError);
    expect(() => parseConfig(`{"ignore":[{"id":"TOKEN-02","reason":"  "}]}`)).toThrow(/reason/);
  });

  it("REFUSES to suppress SAFETY-* checks (structural safety, not convention)", () => {
    expect(() => parseConfig(`{"ignore":[{"id":"SAFETY-01","reason":"we know"}]}`)).toThrow(/cannot be suppressed/);
    expect(() => parseConfig(`{"ignore":[{"id":"safety-04","reason":"x"}]}`)).toThrow(ConfigError);
  });

  it("rejects malformed JSON and non-object roots loudly", () => {
    expect(() => parseConfig("not json")).toThrow(ConfigError);
    expect(() => parseConfig(`["array"]`)).toThrow(ConfigError);
  });
});

describe("loadConfig", () => {
  it("returns null when no config exists, reads it from the scan root when it does", () => {
    const dir = mkdtempSync(join(tmpdir(), "xr-config-"));
    try {
      expect(loadConfig(dir, dir)).toBeNull();
      writeFileSync(join(dir, CONFIG_FILENAME), `{"minGrade":"A-"}`);
      expect(loadConfig(dir, dir)?.minGrade).toBe("A-");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("applySuppressions", () => {
  it("drops the suppressed check, re-scores, and discloses — never silently", () => {
    // dangling-ref fails STRUCT-05 (grade A−); suppressing it should raise the grade AND disclose.
    const { scorecard } = audit(fixture("dangling-ref"));
    expect(scorecard.results.some((r) => r.id === "STRUCT-05" && r.status === "fail")).toBe(true);

    const after = applySuppressions(scorecard, {
      suppressions: [{ id: "STRUCT-05", reason: "refs live in a sibling repo" }],
    });
    expect(after.results.some((r) => r.id === "STRUCT-05")).toBe(false);
    expect(after.overall).toBeGreaterThan(scorecard.overall);
    expect(after.suppressed).toEqual([{ id: "STRUCT-05", reason: "refs live in a sibling repo" }]);
  });

  it("is a no-op (and adds no disclosure) when nothing matches", () => {
    const { scorecard } = audit(fixture("good-skill"));
    const after = applySuppressions(scorecard, { suppressions: [{ id: "NOPE-99", reason: "n/a" }] });
    expect(after).toBe(scorecard);
    expect(after.suppressed).toBeUndefined();
  });

  it("renders the disclosure in terminal and markdown output", () => {
    const { scorecard, name } = audit(fixture("dangling-ref"));
    const after = applySuppressions(scorecard, { suppressions: [{ id: "STRUCT-05", reason: "sibling repo" }] });
    expect(renderTerminal(after, { name })).toContain("suppressed");
    const md = renderMarkdown(after, { name });
    expect(md).toContain("suppressed");
    expect(md).toContain("STRUCT-05");
  });
});
