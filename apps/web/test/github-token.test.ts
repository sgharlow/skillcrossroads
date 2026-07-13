import { describe, it, expect, vi, afterEach } from "vitest";
import { createTokenFallbackFetch } from "../lib/github-token";

function rateLimitedResponse(): Response {
  return new Response("rate limited", { status: 403, headers: { "x-ratelimit-remaining": "0" } });
}

const ORIGINAL_FETCH = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("createTokenFallbackFetch", () => {
  it("passes a normal (ok) response straight through with no retry", async () => {
    const inner = vi.fn(async () => new Response("ok", { status: 200 }));
    const fetchImpl = createTokenFallbackFetch("fallback-token");
    globalThis.fetch = inner;
    const res = await fetchImpl("https://api.github.com/repos/o/r");
    expect(res.status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("does not retry when no fallback token is configured, even on a 403 rate-limit", async () => {
    const inner = vi.fn(async () => rateLimitedResponse());
    globalThis.fetch = inner;
    const fetchImpl = createTokenFallbackFetch(undefined);
    const res = await fetchImpl("https://api.github.com/repos/o/r");
    expect(res.status).toBe(403);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("does not retry on a 403 that isn't a rate-limit (no x-ratelimit-remaining: 0)", async () => {
    const inner = vi.fn(async () => new Response("forbidden", { status: 403 }));
    globalThis.fetch = inner;
    const fetchImpl = createTokenFallbackFetch("fallback-token");
    const res = await fetchImpl("https://api.github.com/repos/o/r");
    expect(res.status).toBe(403);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("retries once with the fallback token's Authorization header on a 403 rate-limit", async () => {
    const seenAuth: Array<string | null> = [];
    let call = 0;
    const inner = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seenAuth.push(headers.get("authorization"));
      call++;
      return call === 1 ? rateLimitedResponse() : new Response("ok-fallback", { status: 200 });
    });
    globalThis.fetch = inner;
    const fetchImpl = createTokenFallbackFetch("fallback-token");
    const res = await fetchImpl("https://api.github.com/repos/o/r", {
      headers: { authorization: "Bearer primary-token" },
    });
    expect(await res.text()).toBe("ok-fallback");
    expect(inner).toHaveBeenCalledTimes(2);
    expect(seenAuth).toEqual(["Bearer primary-token", "Bearer fallback-token"]);
  });

  it("does not retry a second time if the fallback also comes back rate-limited", async () => {
    const inner = vi.fn(async () => rateLimitedResponse());
    globalThis.fetch = inner;
    const fetchImpl = createTokenFallbackFetch("fallback-token");
    const res = await fetchImpl("https://api.github.com/repos/o/r");
    expect(res.status).toBe(403);
    expect(inner).toHaveBeenCalledTimes(2);
  });
});
