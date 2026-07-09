import { describe, it, expect } from "vitest";
import { createMemoryEntitlements } from "../lib/entitlements";

describe("entitlements", () => {
  it("defaults to not-Pro", async () => {
    const e = createMemoryEntitlements();
    expect(await e.isPro("octocat")).toBe(false);
  });

  it("grants and revokes Pro", async () => {
    const e = createMemoryEntitlements();
    await e.setPro("octocat", true, "cus_123");
    expect(await e.isPro("octocat")).toBe(true);
    await e.setPro("octocat", false);
    expect(await e.isPro("octocat")).toBe(false);
  });

  it("maps customer id to login both ways", async () => {
    const e = createMemoryEntitlements();
    await e.setPro("octocat", true, "cus_123");
    expect(await e.customerFor("octocat")).toBe("cus_123");
    expect(await e.loginForCustomer("cus_123")).toBe("octocat");
    expect(await e.loginForCustomer("cus_nope")).toBeUndefined();
  });

  it("preserves the customer id when toggling pro off", async () => {
    const e = createMemoryEntitlements();
    await e.setPro("octocat", true, "cus_123");
    await e.setPro("octocat", false);
    expect(await e.loginForCustomer("cus_123")).toBe("octocat");
  });
});
