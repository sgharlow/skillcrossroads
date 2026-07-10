import { describe, it, expect, afterEach } from "vitest";
import { trustLogin } from "../lib/session";

const ORIG = process.env.BEACON_SESSION_SECRET;
afterEach(() => {
  if (ORIG === undefined) delete process.env.BEACON_SESSION_SECRET;
  else process.env.BEACON_SESSION_SECRET = ORIG;
});

describe("trustLogin — the one identity guard for privileged actions", () => {
  it("returns null for a missing login regardless of stakes", () => {
    expect(trustLogin(undefined, true)).toBeNull();
    expect(trustLogin(undefined, false)).toBeNull();
  });

  it("trusts a login when nothing privileged is at stake, even without a secret", () => {
    delete process.env.BEACON_SESSION_SECRET;
    expect(trustLogin("alice", false)).toBe("alice");
  });

  it("refuses to trust a login when privilege is at stake but no secret signs it", () => {
    delete process.env.BEACON_SESSION_SECRET;
    expect(trustLogin("alice", true)).toBeNull();
  });

  it("trusts a login for a privileged action once a signing secret is configured", () => {
    process.env.BEACON_SESSION_SECRET = "s";
    expect(trustLogin("alice", true)).toBe("alice");
  });
});
