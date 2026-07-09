/** The signed-in user, read from the OAuth cookies set by /api/auth/github/callback. */
export interface Session {
  /** GitHub login, if signed in. */
  login?: string;
  /** GitHub OAuth token (HttpOnly). Used to scan the user's private repos (Pro). */
  token?: string;
}

/** Parse Beacon's auth cookies from a request's Cookie header. Pure — testable without Next. */
export function readSession(req: Request): Session {
  const raw = req.headers.get("cookie") ?? "";
  const map: Record<string, string> = {};
  for (const part of raw.split(/;\s*/)) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    map[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }
  const s: Session = {};
  if (map["beacon_user"]) s.login = map["beacon_user"];
  if (map["beacon_gh"]) s.token = map["beacon_gh"];
  return s;
}
