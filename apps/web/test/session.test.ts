import { describe, it, expect, afterEach } from "vitest";
import { readSession, signUserValue } from "../lib/session";

function reqWithCookie(cookie?: string): Request {
  return new Request("http://localhost/", cookie ? { headers: { cookie } } : {});
}

const ORIG_SECRET = process.env.BEACON_SESSION_SECRET;
afterEach(() => {
  if (ORIG_SECRET === undefined) delete process.env.BEACON_SESSION_SECRET;
  else process.env.BEACON_SESSION_SECRET = ORIG_SECRET;
});

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

describe("identity cookie is unforgeable when BEACON_SESSION_SECRET is set (C2 fix)", () => {
  it("accepts a correctly-signed beacon_user", () => {
    process.env.BEACON_SESSION_SECRET = "super-secret";
    const value = signUserValue("octocat");
    expect(value).toContain(".");
    expect(readSession(reqWithCookie(`beacon_user=${value}`)).login).toBe("octocat");
  });

  it("REJECTS a forged plaintext beacon_user (the exploit)", () => {
    process.env.BEACON_SESSION_SECRET = "super-secret";
    expect(readSession(reqWithCookie("beacon_user=someProUser")).login).toBeUndefined();
  });

  it("REJECTS a beacon_user signed with a different secret", () => {
    process.env.BEACON_SESSION_SECRET = "attacker-secret";
    const forged = signUserValue("victim");
    process.env.BEACON_SESSION_SECRET = "real-secret";
    expect(readSession(reqWithCookie(`beacon_user=${forged}`)).login).toBeUndefined();
  });
});
