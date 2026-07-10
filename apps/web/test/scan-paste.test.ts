import { describe, it, expect } from "vitest";
import { POST } from "../app/api/scan-paste/route";

function formReq(fields: Record<string, string>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request("https://skillcrossroads.com/api/scan-paste", { method: "POST", body: form });
}

const GOOD_SKILL = `---
name: meeting-notes
description: Convert raw meeting notes into structured summaries. Use when the user says "summarize my meeting" or pastes meeting notes.
---

Summarize the notes into decisions, action items, and open questions.

## Verify
Confirm every action item has an owner.
`;

describe("POST /api/scan-paste", () => {
  it("grades a pasted skill and returns a full scorecard page", async () => {
    const res = await POST(formReq({ content: GOOD_SKILL, kind: "skill" }));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Skill Crossroads");
    expect(html).toContain("meeting-notes");
    expect(html).toContain("/100");
  });

  it("grades a pasted command with the command rules (bare frontmatter ok)", async () => {
    const res = await POST(formReq({ content: "Do the thing with $ARGUMENTS.", kind: "command" }));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("[command]");
  });

  it("escapes hostile pasted content (untrusted input)", async () => {
    const res = await POST(formReq({ content: `<script>alert(1)</script>`, kind: "command" }));
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("rejects empty, oversized, and unknown-kind pastes with clear errors", async () => {
    expect((await POST(formReq({ content: "   ", kind: "skill" }))).status).toBe(400);
    expect((await POST(formReq({ content: "x".repeat(200_001), kind: "skill" }))).status).toBe(413);
    expect((await POST(formReq({ content: "hi", kind: "mcp" }))).status).toBe(400);
  });
});
