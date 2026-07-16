import { describe, it, expect } from "vitest";
import { readDemandConfig } from "../src/demand/config.js";

describe("readDemandConfig", () => {
  it("parses owner logins lowercased, trimmed, comma-separated", () => {
    const c = readDemandConfig({ OWNER_LOGINS: "sgharlow, Foo ,,BAR" });
    expect([...c.ownerLogins].sort()).toEqual(["bar", "foo", "sgharlow"]);
  });
  it("defaults: no owners, pre-launch, 0 posts, 30 trend days", () => {
    const c = readDemandConfig({});
    expect(c.ownerLogins.size).toBe(0);
    expect(c.launchDate).toBeNull();
    expect(c.launchPosts).toBe(0);
    expect(c.trendDays).toBe(30);
  });
  it("accepts a valid ISO launch date, rejects malformed", () => {
    expect(readDemandConfig({ LAUNCH_DATE: "2026-07-20" }).launchDate).toBe("2026-07-20");
    expect(readDemandConfig({ LAUNCH_DATE: "July 20" }).launchDate).toBeNull();
    expect(readDemandConfig({ LAUNCH_DATE: "2026-13-40" }).launchDate).toBeNull();
    expect(readDemandConfig({ LAUNCH_DATE: "2026-02-30" }).launchDate).toBeNull();
  });
  it("clamps launchPosts and trendDays to positive integers", () => {
    expect(readDemandConfig({ LAUNCH_POSTS: "2" }).launchPosts).toBe(2);
    expect(readDemandConfig({ LAUNCH_POSTS: "-3" }).launchPosts).toBe(0);
    expect(readDemandConfig({ DEMAND_TREND_DAYS: "14" }).trendDays).toBe(14);
    expect(readDemandConfig({ DEMAND_TREND_DAYS: "0" }).trendDays).toBe(30);
  });
});
