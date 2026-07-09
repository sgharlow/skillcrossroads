import { describe, it, expect } from "vitest";
import { readSession } from "../lib/session";

function reqWithCookie(cookie?: string): Request {
  return new Request("http://localhost/", cookie ? { headers: { cookie } } : {});
}

describe("readSession", () => {
  it("returns empty when there is no cookie", () => {
    expect(readSession(reqWithCookie())).toEqual({});
  });

  it("reads the beacon_user and beacon_gh cookies", () => {
    const s = readSession(reqWithCookie("beacon_user=octocat; beacon_gh=gho_abc123"));
    expect(s.login).toBe("octocat");
    expect(s.token).toBe("gho_abc123");
  });

  it("url-decodes cookie values", () => {
    const s = readSession(reqWithCookie("beacon_user=a%40b"));
    expect(s.login).toBe("a@b");
  });

  it("ignores unrelated cookies", () => {
    const s = readSession(reqWithCookie("other=1; beacon_user=octocat; z=2"));
    expect(s).toEqual({ login: "octocat" });
  });
});
