import { signUserValue } from "@/lib/session";

export const runtime = "nodejs";

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return undefined;
}

/**
 * GET /api/auth/github/callback — exchange the OAuth code for a token and set a session cookie.
 * Scaffold: activates once GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are configured. The token is
 * only used to read the user's login (and, in the Pro tier, to scan private repos).
 */
export async function GET(req: Request): Promise<Response> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ error: "GitHub OAuth is not configured." }, { status: 501 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.json({ error: "missing code" }, { status: 400 });

  // CSRF: the `state` we sent (stored HttpOnly) must echo back, or this is a forged/replayed callback.
  const state = url.searchParams.get("state");
  const expectedState = readCookie(req, "beacon_oauth_state");
  if (!state || !expectedState || state !== expectedState) {
    return Response.json({ error: "invalid OAuth state" }, { status: 400 });
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const token = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!token.access_token) {
    return Response.json({ error: token.error ?? "token exchange failed" }, { status: 502 });
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${token.access_token}`, "user-agent": "beacon" },
  });
  const user = (await userRes.json()) as { login?: string };

  // HttpOnly session cookie — the raw token never reaches the browser JS.
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const headers = new Headers({ location: "/" });
  headers.append(
    "set-cookie",
    `beacon_gh=${encodeURIComponent(token.access_token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${secure}`,
  );
  if (user.login) {
    // Signed (see signUserValue) so the identity that drives Pro entitlement can't be forged.
    // HttpOnly: no client JS needs to read it — server components/routes read it — so keep it out of
    // reach of any XSS. (The token cookie beacon_gh is already HttpOnly.)
    headers.append("set-cookie", `beacon_user=${signUserValue(user.login)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${secure}`);
  }
  // Clear the one-time state cookie.
  headers.append("set-cookie", `beacon_oauth_state=; Path=/; Max-Age=0${secure}`);
  return new Response(null, { status: 302, headers });
}
