/**
 * GitHub token fallback for hosted scans.
 *
 * The hosted app scans on behalf of every anonymous visitor with ONE shared server
 * `GITHUB_TOKEN` (5,000 req/hr; a repo scan is a tree fetch plus several blob fetches, so a
 * traffic spike can exhaust it well before an hour is up). When `GITHUB_TOKEN_FALLBACK` is set,
 * wrap `fetch` so a request that comes back rate-limited on the primary token (403 with
 * `x-ratelimit-remaining: 0`) is retried exactly once against the fallback token before the
 * caller sees a failure. With no fallback configured this is a plain pass-through — zero
 * behavior change for the default single-token deployment.
 */
export function createTokenFallbackFetch(fallbackToken: string | undefined): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await fetch(input, init);
    if (!fallbackToken) return res;
    if (res.status !== 403 || res.headers.get("x-ratelimit-remaining") !== "0") return res;

    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${fallbackToken}`);
    return fetch(input, { ...init, headers });
  };
}
