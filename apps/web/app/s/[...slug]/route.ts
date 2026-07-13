import { after } from "next/server";
import { renderHtml, suggestFixes, badgeUrls, PALETTE, type FixSuggestion } from "@beacon/core";
import { parseSlug, scanTarget, isRepoNotFoundError } from "@/lib/scan";
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

/**
 * A branded, self-contained error page (same "harbor marker light" palette as the scorecard
 * chrome). `messageHtml` must already be escaped by the caller — it's inserted verbatim so it can
 * carry a `<code>`-wrapped slug. Never pass raw upstream error text (e.g. a GitHubError message)
 * here: those can embed internal URLs (api.github.com) and must never reach the response body.
 */
function errorPage(opts: { title: string; heading: string; messageHtml: string; status: number }): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(opts.title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{background:${PALETTE.ink};color:${PALETTE.foam};margin:0;padding:64px 20px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;text-align:center}
.card{max-width:520px;margin:0 auto;background:${PALETTE.ink2};border:1px solid ${PALETTE.ink3};
  border-radius:16px;padding:40px 32px}
h1{font-size:22px;margin:0 0 12px}
p{color:${PALETTE.fog};line-height:1.5;margin:0 0 24px}
code{font-family:ui-monospace,"Cascadia Code","SF Mono",Menlo,Consolas,monospace;color:${PALETTE.foam}}
a.cta{display:inline-block;background:${PALETTE.beam};color:#0b1220;font-weight:700;border-radius:10px;
  padding:11px 20px;text-decoration:none;margin:4px}
a.link{display:inline-block;color:${PALETTE.fog};text-decoration:none;margin:4px}
</style>
</head>
<body>
<div class="card">
<h1>${esc(opts.heading)}</h1>
<p>${opts.messageHtml}</p>
<div>
<a class="cta" href="/">&larr; try another repo</a>
<a class="link" href="/paste">or paste a SKILL.md directly</a>
</div>
</div>
</body>
</html>`;
  return new Response(html, { status: opts.status, headers: { ...HTML, "cache-control": "no-store" } });
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
    // Never reflect the raw upstream error (a GitHubError message embeds api.github.com) — only
    // the escaped slug, which the requester already knows.
    if (isRepoNotFoundError(err)) {
      return errorPage({
        title: "Repo not found — Skill Crossroads",
        heading: "Repo not found",
        messageHtml: `No public repo found at <code>${esc(target.slug)}</code> — check the spelling, or the repo may be private.`,
        status: 404,
      });
    }
    return errorPage({
      title: "Scan unavailable — Skill Crossroads",
      heading: "Scan unavailable",
      messageHtml: `GitHub is rate-limiting us or unreachable right now — try again in a minute. (<code>${esc(target.slug)}</code>)`,
      status: 503,
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
          embed: badgeUrls(origin, target.owner, target.repo, target.subpath),
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
