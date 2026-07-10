import { describe, it, expect, afterEach } from "vitest";
import { GET } from "../app/api/health/route";

const ORIG = process.env.DATABASE_URL;
afterEach(() => {
  if (ORIG === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIG;
});

describe("GET /api/health", () => {
  it("is 200 ok with db not-configured when DATABASE_URL is unset (in-memory mode is expected)", async () => {
    delete process.env.DATABASE_URL;
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe("not-configured");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("is 503 (fail loud) when a DB is configured but unreachable", async () => {
    // A guaranteed-unreachable local address; the route's 2.5s probe timeout bounds the wait.
    process.env.DATABASE_URL = "postgres://user:pw@127.0.0.1:1/db";
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toBe("error");
  }, 10_000);
});
