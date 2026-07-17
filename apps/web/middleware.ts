import { NextResponse, type NextRequest } from "next/server";

/**
 * Launch attribution. When a visitor arrives via a `?ref`-tagged link (e.g. `/report?ref=hn-show`),
 * drop the ref into a short-lived `sc_ref` cookie so a scan they run later in the same session — a
 * same-origin request that carries no external referrer — is still attributed to the channel that
 * brought them. Read back in `lib/attribution.ts` (`scanSource`). Purely additive: no request is
 * blocked or rewritten, only a cookie is attached to the response.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const ref = req.nextUrl.searchParams.get("ref");
  if (ref) {
    res.cookies.set("sc_ref", ref.slice(0, 64), {
      maxAge: 60 * 30, // 30 minutes
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return res;
}

export const config = {
  // Only the pages launch traffic lands on — keeps middleware off static assets, APIs, and badges.
  matcher: ["/", "/report", "/report-agents", "/paste", "/gallery", "/pricing"],
};
