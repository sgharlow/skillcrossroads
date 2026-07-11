import { describe, it, expect } from "vitest";
import { parse, splitFrontmatter, ParseError } from "../src/parse.js";
import { fixture } from "./helpers.js";

describe("splitFrontmatter", () => {
  it("parses a valid frontmatter block", () => {
    const r = splitFrontmatter("---\nname: a\ndescription: b\n---\n\n# Hi\n");
    expect(r.frontmatter).toEqual({ name: "a", description: "b" });
    expect(r.frontmatterError).toBeNull();
    expect(r.bodyStartLine).toBe(5);
    expect(r.body.trim()).toBe("# Hi");
  });

  it("returns null frontmatter when there is no fence", () => {
    const r = splitFrontmatter("# No frontmatter\n\ntext");
    expect(r.frontmatter).toBeNull();
    expect(r.frontmatterError).toBeNull();
    expect(r.bodyStartLine).toBe(1);
  });

  it("reports an unclosed fence", () => {
    const r = splitFrontmatter("---\nname: a\n# never closed");
    expect(r.frontmatter).toBeNull();
    expect(r.frontmatterError).toMatch(/never closed/i);
  });

  it("reports malformed YAML", () => {
    const r = splitFrontmatter("---\nname: : :\n  bad: [unterminated\n---\nbody");
    expect(r.frontmatter).toBeNull();
    expect(r.frontmatterError).toBeTruthy();
  });

  it("handles CRLF line endings", () => {
    const r = splitFrontmatter("---\r\nname: a\r\ndescription: b\r\n---\r\n\r\n# Hi\r\n");
    expect(r.frontmatter).toEqual({ name: "a", description: "b" });
  });
});

describe("parse", () => {
  it("parses a well-formed skill directory", () => {
    const art = parse(fixture("good-skill"));
    expect(art.type).toBe("skill");
    expect(art.frontmatter?.["name"]).toBe("meeting-notes");
    expect(art.files).toContain("references/example.md");
    expect(art.files).not.toContain("SKILL.md");
  });

  it("accepts a direct path to SKILL.md", () => {
    const art = parse(fixture("good-skill") + "/SKILL.md");
    expect(art.frontmatter?.["name"]).toBe("meeting-notes");
  });

  it("throws for a directory without SKILL.md", () => {
    expect(() => parse(fixture("good-skill") + "/references")).toThrow(ParseError);
  });

  it("throws for a missing path", () => {
    expect(() => parse(fixture("does-not-exist"))).toThrow(ParseError);
  });

  it("rejects a plugin parse on a directory without a manifest", () => {
    expect(() => parse(fixture("good-skill"), "plugin")).toThrow(/plugin\.json/i);
  });
});
