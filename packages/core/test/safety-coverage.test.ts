import { describe, it, expect } from "vitest";
import { parse } from "../src/parse.js";
import { safety01 } from "../src/checks/safety-01-secrets.js";
import { fixture } from "./helpers.js";

describe("SAFETY-01 partial-coverage disclosure (no false 'clean' on capped GitHub scans)", () => {
  it("discloses uninspected files in the pass message", () => {
    const base = parse(fixture("good-skill"));
    const artifact = { ...base, unscannedFiles: ["references/a.md", "references/b.md"] };
    const r = safety01.run(artifact);
    expect(r.status).toBe("pass");
    expect(r.evidence[0]!.message).toContain("2 text files not inspected");
  });

  it("makes no coverage claim when everything was scanned (local scan)", () => {
    const r = safety01.run(parse(fixture("good-skill")));
    expect(r.status).toBe("pass");
    expect(r.evidence[0]!.message).toBe("No hardcoded secrets detected.");
  });
});
