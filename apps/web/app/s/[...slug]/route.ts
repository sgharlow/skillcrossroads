import { renderHtml } from "@beacon/core";
import { parseSlug, scanTarget } from "@/lib/scan";
import { resolveScanOptions } from "@/lib/pro-scan";
import { renderRepoSummaryHtml } from "@/lib/summary";
import { recordScans } from "@/lib/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HTML = { "content-type": "text/html; charset=utf-8" } as const;

/** GET /s/:owner/:repo[/...subpath] — shareable public scorecard (one skill) or repo summary. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> {
  const { slug } = await params;
  const target = parseSlug(slug);
  if (!target) {
    return new Response("<h1>Bad path</h1><p>Use /s/owner/repo or /s/owner/repo/path/to/skill.</p>", {
      status: 400,
      headers: HTML,
    });
  }

  let scan;
  try {
    scan = await scanTarget(target, await resolveScanOptions(req));
  } catch (err) {
    return new Response(`<h1>Scan failed</h1><p>${err instanceof Error ? err.message : "error"}</p>`, {
      status: 502,
      headers: HTML,
    });
  }

  if (scan.skills.length === 0) {
    return new Response(`<h1>No skills found</h1><p>No SKILL.md under ${target.slug}.</p>`, {
      status: 404,
      headers: HTML,
    });
  }

  // Record each scored skill for score-history / trends (fire-and-forget).
  recordScans(target.owner, target.repo, scan.skills);

  const body =
    scan.skills.length === 1
      ? renderHtml(scan.skills[0]!.scorecard, { name: scan.skills[0]!.name })
      : renderRepoSummaryHtml(scan, target);

  return new Response(body, {
    headers: { ...HTML, "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
  });
}
