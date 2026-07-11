import { after } from "next/server";
import { renderHtml, suggestFixes, type FixSuggestion } from "@beacon/core";
import { parseSlug, scanTarget } from "@/lib/scan";
import { resolveScanOptions } from "@/lib/pro-scan";
import { renderRepoSummaryHtml } from "@/lib/summary";
import { recordScans } from "@/lib/record";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HTML = { "content-type": "text/html; charset=utf-8" } as const;

/**
 * Escape text for HTML error pages. Error messages (e.g. GitHubError) can embed raw slug
 * segments straight from the request path — reflecting them unescaped is XSS.
 */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
  let scanOpts;
  try {
    scanOpts = await resolveScanOptions(req);
    scan = await scanTarget(target, scanOpts);
  } catch (err) {
    return new Response(`<h1>Scan failed</h1><p>${esc(err instanceof Error ? err.message : "error")}</p>`, {
      status: 502,
      headers: HTML,
    });
  }

  if (scan.skills.length === 0) {
    return new Response(`<h1>No skills found</h1><p>No SKILL.md under ${esc(target.slug)}.</p>`, {
      status: 404,
      headers: HTML,
    });
  }

  // Record each scored skill for score-history / trends. `after()` runs it post-response but keeps
  // the serverless function alive until the writes persist (a bare fire-and-forget is dropped on
  // termination). Best-effort — never fails the scan. When the viewer is signed in, the scan is
  // attributed to them for /account ("your scans"); anonymous scans stay anonymous (login = null).
  const viewer = readSession(req).login;
  after(() => recordScans(target.owner, target.repo, scan.skills, viewer));

  const url = new URL(req.url);
  const origin = url.origin;

  // Pro-only fix suggestions (?suggest=1): single-artifact scans with a managed model. Anonymous /
  // free requests ignore the param entirely (no error) — no model, no suggestions, same public page.
  const suggestWanted =
    url.searchParams.get("suggest") === "1" && Boolean(scanOpts.ctx?.model) && scan.skills.length === 1;
  let suggestions: FixSuggestion[] | undefined;
  if (suggestWanted && scanOpts.ctx) {
    const single = scan.skills[0]!;
    suggestions = await suggestFixes(single.artifact, single.scorecard, scanOpts.ctx);
  }

  const body =
    scan.skills.length === 1
      ? renderHtml(scan.skills[0]!.scorecard, {
          name: scan.skills[0]!.name,
          homeUrl: "/",
          embed: {
            badgeUrl: `${origin}/api/badge/${target.slug}.svg`,
            scorecardUrl: `${origin}/s/${target.slug}`,
          },
          ...(suggestions ? { suggestions } : {}),
        })
      : renderRepoSummaryHtml(scan, target, { homeUrl: "/" });

  // Pro-optioned responses (private token / managed LLM — including ?suggest=1, which requires
  // the managed model) must NEVER enter the shared CDN cache: the URL is the same as the public
  // scorecard's and the edge cache does not vary on cookies, so a cached Pro page (private-repo
  // content, keyed grades, suggestions) would serve to everyone. Mirrors the badge route.
  const anonymous = !scanOpts.token && !scanOpts.ctx?.model;
  const cacheControl = anonymous
    ? "public, max-age=0, s-maxage=300, stale-while-revalidate=600"
    : "private, no-store";
  return new Response(body, { headers: { ...HTML, "cache-control": cacheControl } });
}
