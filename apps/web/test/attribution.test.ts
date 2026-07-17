import { describe, it, expect } from "vitest";
import { scanSource } from "../lib/attribution";

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe("scanSource", () => {
  it("prefers an explicit ?ref on the scan URL", () => {
    expect(scanSource(req("https://skillcrossroads.com/s/o/r?ref=hn-show"))).toBe("hn-show");
  });

  it("falls back to the sc_ref cookie (forwarded from a ?ref-tagged landing)", () => {
    expect(
      scanSource(req("https://skillcrossroads.com/s/o/r", { cookie: "beacon_user=x; sc_ref=reddit-claudeai" })),
    ).toBe("reddit-claudeai");
  });

  it("an explicit ?ref wins over the cookie", () => {
    expect(
      scanSource(req("https://skillcrossroads.com/s/o/r?ref=hn-show", { cookie: "sc_ref=reddit-claudeai" })),
    ).toBe("hn-show");
  });

  it("falls back to a mapped external referrer host when there is no ref/cookie", () => {
    expect(scanSource(req("https://skillcrossroads.com/s/o/r", { referer: "https://www.reddit.com/r/ClaudeAI/x" }))).toBe(
      "reddit",
    );
  });

  it("ignores a same-origin referrer (a scan run after landing is not self-attributed)", () => {
    expect(
      scanSource(req("https://skillcrossroads.com/s/o/r", { referer: "https://skillcrossroads.com/report" })),
    ).toBeUndefined();
  });

  it("is undefined when unattributable", () => {
    expect(scanSource(req("https://skillcrossroads.com/s/o/r"))).toBeUndefined();
  });
});
