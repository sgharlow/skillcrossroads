import { after } from "next/server";
import { renderBadge, type Scorecard } from "@beacon/core";
import { parseSlug, scanTarget, averageGrade, type SlugTarget, type ScanOptions } from "@/lib/scan";
import { resolveScanOptions } from "@/lib/pro-scan";
import { badgeCache, isStale } from "@/lib/badge-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Scan + render. `ok` distinguishes a real grade from the "n/a" error badge (never cached). */
async function computeBadge(target: SlugTarget, opts: ScanOptions): Promise<{ svg: string; ok: boolean }> {
  let card: Scorecard | null = null;
  let grade = "?";
  try {
    const scan = await scanTarget(target, opts);
    if (scan.skills.length === 1) {
      card = scan.skills[0]!.scorecard; // real scorecard → badge discloses a partial (keyless) grade
      grade = card.grade;
    } else if (scan.skills.length > 1) {
      grade = averageGrade(scan);
      // Repo-average badge is partial if ANY constituent skill was only partially graded (keyless).
      card = { grade, partial: scan.skills.some((s) => s.scorecard.partial) } as Scorecard;
    }
  } catch {
    grade = "?";
  }
  if (grade === "?") return { svg: renderBadge({ grade } as Scorecard, { value: "n/a" }), ok: false };
  return { svg: renderBadge(card ?? ({ grade } as Scorecard)), ok: true };
}

/** Recompute an anonymous badge and store it — the background half of stale-while-revalidate. */
async function refreshBadge(target: SlugTarget): Promise<void> {
  const { svg, ok } = await computeBadge(target, {});
  if (ok) await badgeCache.put(target.slug, svg);
}

/** Runs `fn` after the response via Next `after()`; outside a request scope (tests) it's a no-op. */
function background(fn: () => Promise<void>): void {
  try {
    after(() => fn().catch(() => {}));
  } catch {
    /* not in a request scope — skip the refresh */
  }
}

function svgResponse(svg: string): Response {
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // CDN layer on top of the DB cache: fresh for 5 min at the edge, stale-while-revalidate after.
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

/**
 * GET /api/badge/:owner/:repo[/...subpath][.svg] — grade badge.
 *
 * Anonymous requests (GitHub camo, READMEs) serve the last-known SVG from the badge cache
 * instantly — a cold repo scan (~5–6 s) can outlast camo's ~4 s timeout, so embedded badges
 * must never wait on a scan once one has ever completed. A stale hit triggers a background
 * re-scan (`after()`). Pro-optioned requests (private token / managed LLM) bypass the cache in
 * BOTH directions, so a keyed grade never leaks into the public badge.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> {
  const { slug } = await params;
  const parts = [...slug];
  if (parts.length) parts[parts.length - 1] = (parts[parts.length - 1] as string).replace(/\.svg$/i, "");
  const target = parseSlug(parts);
  if (!target) return new Response("Bad badge path", { status: 400 });

  const opts = await resolveScanOptions(req);
  const anonymous = !opts.token && !opts.ctx?.model;

  if (anonymous) {
    const hit = await badgeCache.get(target.slug).catch(() => null);
    if (hit) {
      if (isStale(hit.scannedAt)) background(() => refreshBadge(target));
      return svgResponse(hit.svg);
    }
  }

  const { svg, ok } = await computeBadge(target, opts);
  // First-ever anonymous render: persist it so every later request is a fast cache hit.
  if (anonymous && ok) background(() => badgeCache.put(target.slug, svg));
  return svgResponse(svg);
}
