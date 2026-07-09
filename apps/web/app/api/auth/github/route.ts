import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

/**
 * GET /api/auth/github — start the GitHub OAuth flow.
 * Gated on GITHUB_CLIENT_ID (+ SECRET, used at the callback). Until those env vars are set the
 * route explains what's missing instead of 500ing — the flow is built, not yet configured.
 */
export async function GET(req: Request): Promise<Response> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return Response.json(
      {
        error: "GitHub OAuth is not configured.",
        needed: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
        note: "Create a GitHub OAuth App, set the callback to <origin>/api/auth/github/callback, then set these env vars.",
      },
      { status: 501 },
    );
  }
  const url = new URL(req.url);
  const origin = url.origin;
  const redirectUri = `${origin}/api/auth/github/callback`;
  // CSRF: a random state, stored HttpOnly and echoed in the callback, defeats OAuth login-CSRF.
  const state = randomBytes(16).toString("hex");
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "read:user"); // least-privilege; add repo scope for private scans (Pro)
  authorize.searchParams.set("state", state);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      "set-cookie": `beacon_oauth_state=${state}; HttpOnly; Path=/; SameSite=Lax; Max-Age=600${secure}`,
    },
  });
}
