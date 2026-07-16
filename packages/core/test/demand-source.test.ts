import { describe, it, expect } from "vitest";
import { normalizeSource } from "../src/demand/source.js";

describe("normalizeSource", () => {
  it("prefers a campaign ref, sanitized and lowercased", () => {
    expect(normalizeSource("Reddit", null)).toBe("reddit");
    expect(normalizeSource("HN Launch!!", null)).toBe("hn-launch");
  });
  it("caps ref length at 32 chars", () => {
    expect(normalizeSource("a".repeat(50), null)).toBe("a".repeat(32));
  });
  it("falls back to a mapped referrer host when no ref", () => {
    expect(normalizeSource(null, "news.ycombinator.com")).toBe("hn");
    expect(normalizeSource(null, "www.reddit.com")).toBe("reddit");
    expect(normalizeSource(null, "x.com")).toBe("x");
  });
  it("returns the bare host for an unmapped referrer", () => {
    expect(normalizeSource(null, "www.example.com")).toBe("example.com");
  });
  it("returns null when neither ref nor referrer is usable", () => {
    expect(normalizeSource(null, null)).toBeNull();
    expect(normalizeSource("   ", null)).toBeNull();
    expect(normalizeSource("!!!", null)).toBeNull();
  });
});
