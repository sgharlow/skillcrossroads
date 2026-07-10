import { describe, it, expect, afterEach } from "vitest";
import { POST as logout } from "../app/api/auth/logout/route";
import { POST as portal } from "../app/api/billing/portal/route";
import { entitlements } from "../lib/entitlements";
import { signUserValue } from "../lib/session";

function req(cookie = ""): Request {
  return new Request("https://skillcrossroads.com/api/x", { method: "POST", headers: cookie ? { cookie } : {} });
}

const SNAP = { stripe: process.env.STRIPE_SECRET_KEY, secret: process.env.BEACON_SESSION_SECRET };
afterEach(() => {
  for (const [k, v] of [
    ["STRIPE_SECRET_KEY", SNAP.stripe],
    ["BEACON_SESSION_SECRET", SNAP.secret],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("POST /api/auth/logout", () => {
  it("expires both auth cookies and redirects home", async () => {
    const res = await logout(req("beacon_gh=tok; beacon_user=someone"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => /^beacon_gh=;/.test(c) && /Max-Age=0/.test(c))).toBe(true);
    expect(cookies.some((c) => /^beacon_user=;/.test(c) && /Max-Age=0/.test(c))).toBe(true);
  });
});

describe("POST /api/billing/portal", () => {
  it("returns 501 when Stripe is unconfigured (not 500)", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await portal(req("beacon_user=someone"));
    expect(res.status).toBe(501);
    expect((await res.json()).needed).toContain("STRIPE_SECRET_KEY");
  });

  it("requires a signed-in identity (401)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    const res = await portal(req()); // no cookie
    expect(res.status).toBe(401);
    expect((await res.json()).signIn).toBe("/api/auth/github");
  });

  it("rejects a forged (unsigned) identity when a secret is configured — no IDOR", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.BEACON_SESSION_SECRET = "test-secret";
    // An unsigned beacon_user is a forgery attempt when a secret is set → 401, never someone's portal.
    const res = await portal(req("beacon_user=victim-login"));
    expect(res.status).toBe(401);
  });

  it("fails closed on a plaintext identity for billing when NO secret is set", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    delete process.env.BEACON_SESSION_SECRET;
    // Billing is privilege-at-stake: with no signing secret, a plaintext cookie can't be trusted → 401.
    const res = await portal(req("beacon_user=anyone"));
    expect(res.status).toBe(401);
  });

  it("redirects a signed-in, never-subscribed user to /pricing (no Stripe call)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.BEACON_SESSION_SECRET = "test-secret";
    const res = await portal(req(`beacon_user=${signUserValue("never-subscribed-user")}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://skillcrossroads.com/pricing");
  });

  it("redirects a Pro user with no customer id to /pricing (can't open a portal without a customer)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.BEACON_SESSION_SECRET = "test-secret";
    await entitlements.setPro("pro-no-customer-signed", true);
    const res = await portal(req(`beacon_user=${signUserValue("pro-no-customer-signed")}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://skillcrossroads.com/pricing");
  });
});
