import { describe, it, expect, afterEach } from "vitest";
import { resolveScanOptions } from "../lib/pro-scan";
import { entitlements } from "../lib/entitlements";
import { signUserValue } from "../lib/session";

function req(cookie: string): Request {
  return new Request("https://beacon.dev/", { headers: { cookie } });
}

const SNAP = {
  secret: process.env.BEACON_SESSION_SECRET,
  managed: process.env.BEACON_MANAGED_ANTHROPIC_KEY,
  db: process.env.DATABASE_URL,
};
afterEach(() => {
  for (const [k, v] of [
    ["BEACON_SESSION_SECRET", SNAP.secret],
    ["BEACON_MANAGED_ANTHROPIC_KEY", SNAP.managed],
    ["DATABASE_URL", SNAP.db],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("resolveScanOptions fails CLOSED when identity can't be verified but privilege is at stake", () => {
  it("denies Pro (and managed LLM) when a managed key is set but BEACON_SESSION_SECRET is not", async () => {
    delete process.env.BEACON_SESSION_SECRET;
    process.env.BEACON_MANAGED_ANTHROPIC_KEY = "sk-ant-managed-test";
    await entitlements.setPro("prouser-a", true);
    // Even a would-be-Pro identity is not trusted → no managed model, no server-key spend.
    const opts = await resolveScanOptions(req("beacon_user=prouser-a"));
    expect(opts.pro).toBe(false);
    expect(opts.ctx).toBeUndefined();
  });

  it("grants Pro with a signed identity when BEACON_SESSION_SECRET IS set", async () => {
    process.env.BEACON_SESSION_SECRET = "test-secret";
    process.env.BEACON_MANAGED_ANTHROPIC_KEY = "sk-ant-managed-test";
    await entitlements.setPro("prouser-b", true);
    const opts = await resolveScanOptions(req(`beacon_user=${signUserValue("prouser-b")}`));
    expect(opts.pro).toBe(true);
    expect(opts.ctx?.model).toBeTruthy(); // managed model attached
  });

  it("still allows Pro with no secret when NO privilege is at stake (dev/unconfigured)", async () => {
    delete process.env.BEACON_SESSION_SECRET;
    delete process.env.BEACON_MANAGED_ANTHROPIC_KEY;
    delete process.env.DATABASE_URL;
    await entitlements.setPro("prouser-c", true);
    const opts = await resolveScanOptions(req("beacon_user=prouser-c"));
    expect(opts.pro).toBe(true);
  });
});
