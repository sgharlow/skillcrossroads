import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../lib/markdown-lite";
import { REPORT_MD } from "../content/report";

describe("markdownToHtml (report renderer)", () => {
  it("renders headings, bold, code, lists, and blockquotes", () => {
    const html = markdownToHtml("# Title\n\n## Section\n\n**bold** and `code`\n\n- one\n- two\n\n> quoted");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<h2>Section</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<blockquote><p>quoted</p></blockquote>");
  });

  it("renders tables with header and body rows", () => {
    const html = markdownToHtml("| Grade | N |\n|---|---|\n| A | 1 |\n| B | 37 |");
    expect(html).toContain("<th>Grade</th>");
    expect(html).toContain("<td>37</td>");
    expect(html).not.toContain("---");
  });

  it("preserves fenced code blocks verbatim (no inline formatting inside)", () => {
    const html = markdownToHtml("```\n**not bold** █░ 27%\n```");
    expect(html).toContain("<pre><code>**not bold** █░ 27%</code></pre>");
  });

  it("escapes HTML in source (safe by construction)", () => {
    const html = markdownToHtml("hello <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders the actual published report without losing its headline figures", () => {
    const html = markdownToHtml(REPORT_MD);
    expect(html).toContain("<h1>The State of Claude Code Skills</h1>");
    expect(html).toContain("73.6/100"); // average score survives conversion
    expect(html).toContain("<table>"); // grade-distribution + methodology tables render
    expect(html).toContain("214"); // sample size present
    expect(html).not.toContain("undefined");
  });
});
