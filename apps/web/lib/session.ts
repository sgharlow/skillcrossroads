import { createHmac, timingSafeEqual } from "node:crypto";

/** The signed-in user, read from the OAuth cookies set by /api/auth/github/callback. */
export interface Session {
  /** GitHub login, if signed in. */
  login?: string;
  /** GitHub OAuth token (HttpOnly). Used to scan the user's private repos (Pro). */
  token?: string;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * The value for the `beacon_user` cookie. When BEACON_SESSION_SECRET is set (production), the login
 * is HMAC-signed so it cannot be forged — the identity that drives Pro entitlement + managed-LLM
 * spend must not be a client-writable plaintext cookie. Without a secret (dev/unconfigured, where
 * there is no managed key and thus no cost exposure) it falls back to the plain encoded login.
 */
export function signUserValue(login: string): string {
  const enc = encodeURIComponent(login);
  const secret = process.env.BEACON_SESSION_SECRET;
  return secret ? `${enc}.${sign(enc, secret)}` : enc;
}

/** Verify + decode a `beacon_user` cookie value. Returns null if a secret is configured and the signature is absent/invalid. */
function verifyUser(value: string): string | null {
  const secret = process.env.BEACON_SESSION_SECRET;
  if (!secret) return decodeURIComponent(value); // unconfigured: no managed key → no privilege to steal
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null; // a secret is set but the cookie is unsigned → reject (forgery attempt)
  const enc = value.slice(0, dot);
  if (!safeEqualHex(value.slice(dot + 1), sign(enc, secret))) return null;
  return decodeURIComponent(enc);
}

/** Parse Beacon's auth cookies from a request's Cookie header. The identity cookie is signature-verified. */
export function readSession(req: Request): Session {
  return readSessionFromCookieHeader(req.headers.get("cookie") ?? "");
}

/**
 * Gate a login for a privileged action. The `beacon_user` cookie is only unforgeable when
 * BEACON_SESSION_SECRET signs it; when something of value is at stake (Stripe billing, managed-LLM
 * spend, a real entitlements/history DB) but no secret is configured, a forged plaintext cookie
 * must NOT be trusted. Returns the login only when it is safe to act on it, else null. This is the
 * ONE place that decision lives — billing, checkout, Pro scans, and /account all go through it
 * (structural safety, not a per-caller convention).
 */
export function trustLogin(login: string | undefined, privilegeAtStake: boolean): string | null {
  if (!login) return null;
  if (privilegeAtStake && !process.env.BEACON_SESSION_SECRET) return null;
  return login;
}

/**
 * Same as readSession but from a raw Cookie header string — for server components, which read
 * cookies via `next/headers` rather than a Request. The identity cookie is signature-verified.
 */
export function readSessionFromCookieHeader(raw: string): Session {
  const map: Record<string, string> = {};
  for (const part of raw.split(/;\s*/)) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    map[part.slice(0, eq)] = part.slice(eq + 1); // keep raw; decode per-field
  }
  const s: Session = {};
  if (map["beacon_user"]) {
    const login = verifyUser(map["beacon_user"]);
    if (login) s.login = login;
  }
  if (map["beacon_gh"]) s.token = decodeURIComponent(map["beacon_gh"]);
  return s;
}
