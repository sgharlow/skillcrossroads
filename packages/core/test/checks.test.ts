import { describe, it, expect } from "vitest";
import { struct01 } from "../src/checks/struct-01-frontmatter.js";
import { struct02 } from "../src/checks/struct-02-fields.js";
import { struct05 } from "../src/checks/struct-05-references.js";
import { token01 } from "../src/checks/token-01-budget.js";
import { clarity03 } from "../src/checks/clarity-03-filler.js";
import { safety01 } from "../src/checks/safety-01-secrets.js";
import { makeArtifact } from "./helpers.js";

describe("STRUCT-01 valid frontmatter", () => {
  it("passes with a valid mapping", () => {
    expect(struct01.run(makeArtifact()).status).toBe("pass");
  });
  it("fails when frontmatter is absent", () => {
    const r = struct01.run(makeArtifact({ frontmatter: null, frontmatterError: null }));
    expect(r.status).toBe("fail");
    expect(r.evidence[0]?.message).toMatch(/no yaml frontmatter/i);
  });
  it("fails when frontmatter is malformed", () => {
    const r = struct01.run(makeArtifact({ frontmatter: null, frontmatterError: "bad yaml" }));
    expect(r.status).toBe("fail");
    expect(r.evidence[0]?.message).toMatch(/bad yaml/);
  });
});

describe("STRUCT-02 recommended fields", () => {
  it("passes with name and description", () => {
    expect(struct02.run(makeArtifact()).status).toBe("pass");
  });
  it("warns when name is missing", () => {
    const r = struct02.run(makeArtifact({ frontmatter: { description: "y" } }));
    expect(r.status).toBe("warn");
  });
  it("fails when description is missing", () => {
    const r = struct02.run(makeArtifact({ frontmatter: { name: "x" } }));
    expect(r.status).toBe("fail");
  });
  it("fails when description is empty", () => {
    const r = struct02.run(makeArtifact({ frontmatter: { name: "x", description: "   " } }));
    expect(r.status).toBe("fail");
  });
});

describe("STRUCT-05 references resolve", () => {
  it("passes when references resolve", () => {
    const r = struct05.run(
      makeArtifact({
        raw: "See [x](./references/example.md) and `./helper.py`.",
        files: ["references/example.md", "helper.py"],
      }),
    );
    expect(r.status).toBe("pass");
  });
  it("fails on a dangling reference", () => {
    const r = struct05.run(
      makeArtifact({ raw: "See [x](./references/missing.md).", files: [] }),
    );
    expect(r.status).toBe("fail");
    expect(r.evidence[0]?.line).toBe(1);
    expect(r.evidence[0]?.message).toMatch(/does not resolve/i);
  });
  it("ignores external URLs and anchors", () => {
    const r = struct05.run(
      makeArtifact({ raw: "[a](https://example.com) [b](#section) [c](mailto:x@y.z)", files: [] }),
    );
    expect(r.status).toBe("pass");
  });
});

describe("TOKEN-01 budget", () => {
  it("passes for a small file", () => {
    expect(token01.run(makeArtifact({ raw: "line\n".repeat(100) })).status).toBe("pass");
  });
  it("warns between the guidance and the hard limit", () => {
    expect(token01.run(makeArtifact({ raw: "line\n".repeat(600) })).status).toBe("warn");
  });
  it("fails for a very long file", () => {
    expect(token01.run(makeArtifact({ raw: "line\n".repeat(900) })).status).toBe("fail");
  });
  it("reports an estimated token count", () => {
    const r = token01.run(makeArtifact({ raw: "abcd".repeat(1000) }));
    expect(r.evidence[0]?.message).toMatch(/tokens/);
  });
});

describe("CLARITY-03 filler", () => {
  const banner = "=".repeat(14);
  it("passes on clean prose", () => {
    expect(clarity03.run(makeArtifact({ body: "# Title\n\nDo the thing.\n" })).status).toBe("pass");
  });
  it("warns on a single banner line", () => {
    expect(clarity03.run(makeArtifact({ body: `# Title\n${banner}\ntext\n` })).status).toBe("warn");
  });
  it("fails on many banner lines", () => {
    const body = `# T\n${banner}\na\n${banner}\nb\n${banner}\nc\n${banner}\n`;
    expect(clarity03.run(makeArtifact({ body })).status).toBe("fail");
  });
  it("flags persona filler", () => {
    const r = clarity03.run(makeArtifact({ body: "You are a 10x rockstar ninja engineer.\n" }));
    expect(r.status).toBe("warn");
  });
  it("does not flag markdown table separators", () => {
    const r = clarity03.run(makeArtifact({ body: "| a | b |\n| --- | --- |\n| 1 | 2 |\n" }));
    expect(r.status).toBe("pass");
  });
});

describe("SAFETY-01 secrets", () => {
  it("passes on a clean file", () => {
    expect(safety01.run(makeArtifact({ raw: "no secrets here\n" })).status).toBe("pass");
  });
  it("flags an AWS access key", () => {
    const r = safety01.run(makeArtifact({ raw: "key = AKIAIOSFODNN7EXAMPLE\n" }));
    expect(r.status).toBe("fail");
    expect(r.evidence[0]?.message).toMatch(/AWS/);
  });
  it("redacts the secret in evidence", () => {
    const r = safety01.run(makeArtifact({ raw: "key = AKIAIOSFODNN7EXAMPLE\n" }));
    expect(r.evidence[0]?.snippet).not.toContain("IOSFODNN7");
    expect(r.evidence[0]?.snippet).toContain("*");
  });
  it("flags an assigned credential literal", () => {
    const r = safety01.run(makeArtifact({ raw: 'password = "hunter2hunter2"\n' }));
    expect(r.status).toBe("fail");
  });
});
