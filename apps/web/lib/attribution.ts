import { normalizeSource } from "@beacon/core";

/** The Referer host, but only when it is a different origin than this request (else null). */
function externalRefererHost(req: Request): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    const h = new URL(ref).host;
    return h && h !== new URL(req.url).host ? h : null;
  } catch {
    return null;
  }
}

/** Read a single cookie value from the request's Cookie header (undecoded name match). */
function cookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return null;
}

/**
 * Attribution source for a scan. Precedence: an explicit `?ref` on the scan URL wins, then the
 * `sc_ref` cookie (set by middleware when the visitor arrived on a `?ref`-tagged launch link, so a
 * scan they run later in the same session — a same-origin request with no external referrer — is
 * still attributed to the channel that brought them), then the external referrer host. `undefined`
 * when unattributable. Single source of the scan-source rule, shared by the scan + gallery routes.
 */
export function scanSource(req: Request): string | undefined {
  const url = new URL(req.url);
  // `||` (not `??`) so an empty `?ref=` also falls through to the cookie.
  const ref = url.searchParams.get("ref") || cookie(req, "sc_ref") || null;
  return normalizeSource(ref, externalRefererHost(req)) ?? undefined;
}
