export const runtime = "nodejs";

/**
 * POST /api/auth/logout — sign out by expiring both auth cookies.
 * There is no server-side session store: the GitHub token lives only in the HttpOnly `beacon_gh`
 * cookie, so clearing the cookies fully ends the session. POST (not GET) so a cross-site image/link
 * can't silently log a user out. Flags mirror how each cookie was set (see the OAuth callback).
 */
export async function POST(req: Request): Promise<Response> {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  const headers = new Headers({ location: "/" });
  headers.append("set-cookie", `beacon_gh=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  headers.append("set-cookie", `beacon_user=; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  return new Response(null, { status: 303, headers });
}
