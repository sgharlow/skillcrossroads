export const runtime = "nodejs";

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
  const headers = new Headers({ location: "/" });
  headers.append(
    "set-cookie",
    `beacon_gh=${encodeURIComponent(token.access_token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${
      url.protocol === "https:" ? "; Secure" : ""
    }`,
  );
  if (user.login) {
    headers.append("set-cookie", `beacon_user=${encodeURIComponent(user.login)}; Path=/; SameSite=Lax; Max-Age=604800`);
  }
  return new Response(null, { status: 302, headers });
}
