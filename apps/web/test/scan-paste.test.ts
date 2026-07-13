import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pro-scan", () => ({ resolveScanOptions: vi.fn(async () => ({ pro: false })) }));

import { POST } from "../app/api/scan-paste/route";
import { resolveScanOptions } from "../lib/pro-scan";
import { _resetRateLimitStateForTests } from "../lib/rate-limit";

const resolveScanOptionsMock = vi.mocked(resolveScanOptions);

function formReq(fields: Record<string, string>, ip = "1.1.1.1"): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request("https://skillcrossroads.com/api/scan-paste", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveScanOptionsMock.mockResolvedValue({ pro: false });
});

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
    _resetRateLimitStateForTests();
    expect((await POST(formReq({ content: "   ", kind: "skill" }))).status).toBe(400);
    expect((await POST(formReq({ content: "x".repeat(200_001), kind: "skill" }))).status).toBe(413);
    expect((await POST(formReq({ content: "hi", kind: "mcp" }))).status).toBe(400);
  });
});

describe("POST /api/scan-paste — per-IP rate limiting", () => {
  it("429s past 10 requests from the same connection, with Retry-After + no-store + matching HTML content type", async () => {
    _resetRateLimitStateForTests();
    for (let i = 0; i < 10; i++) {
      const res = await POST(formReq({ content: GOOD_SKILL, kind: "skill" }));
      expect(res.status).toBe(200);
    }
    const blocked = await POST(formReq({ content: GOOD_SKILL, kind: "skill" }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(blocked.headers.get("cache-control")).toBe("no-store");
    expect(blocked.headers.get("content-type")).toContain("text/html");
    const html = await blocked.text();
    expect(html).toContain("Slow down");
  });

  it("gives a signed-in Pro request a higher ceiling (60) than the anonymous limit (10)", async () => {
    _resetRateLimitStateForTests();
    resolveScanOptionsMock.mockResolvedValue({ pro: true });
    for (let i = 0; i < 11; i++) {
      const res = await POST(formReq({ content: GOOD_SKILL, kind: "skill" }, "6.6.6.6"));
      expect(res.status).toBe(200);
    }
  });

  it("tracks anonymous and pro requests from the same IP as separate buckets", async () => {
    _resetRateLimitStateForTests();
    resolveScanOptionsMock.mockResolvedValue({ pro: false });
    for (let i = 0; i < 10; i++) {
      expect((await POST(formReq({ content: GOOD_SKILL, kind: "skill" }, "7.7.7.7"))).status).toBe(200);
    }
    expect((await POST(formReq({ content: GOOD_SKILL, kind: "skill" }, "7.7.7.7"))).status).toBe(429);

    resolveScanOptionsMock.mockResolvedValue({ pro: true });
    expect((await POST(formReq({ content: GOOD_SKILL, kind: "skill" }, "7.7.7.7"))).status).toBe(200);
  });
});
