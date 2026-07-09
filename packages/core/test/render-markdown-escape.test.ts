import { describe, it, expect } from "vitest";
import { renderMarkdown, mdCell } from "../src/render/markdown.js";
import type { Scorecard, CheckResult } from "../src/types.js";

function scorecard(results: CheckResult[], name = "x"): Scorecard {
  return { rubricVersion: "1.0", overall: 70, grade: "C", categories: [], results, partial: false, ...(name ? {} : {}) };
}

const evilResult: CheckResult = {
  id: "STRUCT-05",
  category: "correctness",
  title: "Supporting-file references resolve",
  weight: 1,
  status: "fail",
  score: 0,
  evidence: [{ file: "SKILL.md", line: 4, message: "evil ![pixel](http://tracker/p) | <script>alert(1)</script>" }],
  fix: "remove `dead` | link ]](http://x)",
};

describe("markdown renderer escaping (untrusted skill content → PR comment)", () => {
  it("neutralizes image/link/html/pipe injection in evidence and fixes", () => {
    const md = renderMarkdown(scorecard([evilResult]), { name: "pay | now <b>" });
    expect(md).not.toContain("![pixel](http://tracker/p)"); // image injection killed
    expect(md).not.toContain("<script>"); // raw HTML neutralized
    expect(md).toContain("&lt;script&gt;");
    expect(md).toContain("\\|"); // table/inline pipe escaped
  });

  it("does NOT escape Beacon's own trusted ids/titles", () => {
    const md = renderMarkdown(scorecard([evilResult]));
    expect(md).toContain("**STRUCT-05**");
    expect(md).toContain("Supporting-file references resolve");
  });

  it("mdCell escapes pipes and collapses newlines for table cells", () => {
    expect(mdCell("a | b")).toContain("\\|");
    expect(mdCell("line1\nline2")).toBe("line1 line2");
  });
});
