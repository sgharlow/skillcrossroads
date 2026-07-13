import { parseSlug, scanTarget } from "@/lib/scan";
import { resolveScanOptions } from "@/lib/pro-scan";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anonymous per-IP window: 10 scans / 5 min — enough for normal use, not enough to fan out a scrape. */
const ANON_LIMIT = { limit: 10, windowMs: 5 * 60 * 1000 };
/** Signed-in Pro scans (resolved via resolveScanOptions/trust-login) get a higher ceiling — the
 * anonymous cap exists to protect the shared server GITHUB_TOKEN, not to throttle paying users. */
const PRO_LIMIT = { limit: 60, windowMs: 5 * 60 * 1000 };

/** A 429 must never enter the CDN cache — `no-store`, plus `Retry-After` so a well-behaved client backs off. */
function tooManyRequests(retryAfterSec: number): Response {
  return Response.json(
    { error: "Too many scans from this connection — try again shortly." },
    { status: 429, headers: { "retry-after": String(retryAfterSec), "cache-control": "no-store" } },
  );
}

/** GET /api/scan?repo=owner/repo[/subpath] — JSON scan result. */
export async function GET(req: Request): Promise<Response> {
  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo) return Response.json({ error: "missing ?repo=owner/repo" }, { status: 400 });
  const target = parseSlug(repo.replace(/^https?:\/\/github\.com\//i, "").split("/"));
  if (!target) return Response.json({ error: "bad repo" }, { status: 400 });

  const opts = await resolveScanOptions(req);
  const limits = opts.pro ? PRO_LIMIT : ANON_LIMIT;
  const rl = rateLimit(`scan:${opts.pro ? "pro" : "anon"}:${clientIp(req)}`, limits);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec);

  try {
    const scan = await scanTarget(target, opts);
    return Response.json(
      {
        repo: `${target.owner}/${target.repo}`,
        ref: scan.ref,
        treeSha: scan.treeSha,
        skills: scan.skills.map((s) => ({ repoPath: s.repoPath, name: s.name, ...s.scorecard })),
        errors: scan.errors,
      },
      { headers: { "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "scan failed" }, { status: 502 });
  }
}
