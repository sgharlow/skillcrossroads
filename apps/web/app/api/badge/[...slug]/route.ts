import { after } from "next/server";
import { renderBadge, type Scorecard } from "@beacon/core";
import { parseSlug, scanTarget, averageGrade, type SlugTarget, type ScanOptions } from "@/lib/scan";
import { resolveScanOptions } from "@/lib/pro-scan";
import { badgeCache, isStale, isExpired } from "@/lib/badge-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cache key for a badge: GitHub owner/repo are case-insensitive, so differently-cased README
 * embeds must share one entry (and one background refresh). The subpath stays case-sensitive
 * (it names real files).
 */
function cacheKey(target: SlugTarget): string {
  const base = `${target.owner.toLowerCase()}/${target.repo.toLowerCase()}`;
  return target.subpath ? `${base}/${target.subpath}` : base;
}

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

/** In-flight background refreshes (per instance) — a burst of stale hits must not fan out N scans. */
const refreshing = new Set<string>();

/** Recompute an anonymous badge and store it — the background half of stale-while-revalidate. */
async function refreshBadge(target: SlugTarget, key: string): Promise<void> {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  try {
    const { svg, ok } = await computeBadge(target, {});
    if (ok) await badgeCache.put(key, svg);
  } finally {
    refreshing.delete(key);
  }
}

/** Runs `fn` after the response via Next `after()`; outside a request scope (tests) it's a no-op. */
function background(fn: () => Promise<void>): void {
  try {
    after(() => fn().catch(() => {}));
  } catch {
    /* not in a request scope — skip the refresh */
  }
}

function svgResponse(svg: string, anonymous: boolean): Response {
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Anonymous badges: CDN layer on top of the DB cache. Pro-optioned responses must NEVER
      // enter the shared CDN cache — the URL is the same as the public badge's, and an edge
      // cache does not vary on cookies, so a cached keyed grade would serve to everyone.
      "cache-control": anonymous
        ? "public, max-age=0, s-maxage=300, stale-while-revalidate=600"
        : "private, no-store",
    },
  });
}

/**
 * GET /api/badge/:owner/:repo[/...subpath][.svg] — grade badge.
 *
 * Anonymous requests (GitHub camo, READMEs) serve the last-known SVG from the badge cache
 * instantly — a cold repo scan (~5–6 s) can outlast camo's ~4 s timeout, so embedded badges
 * must never wait on a scan once one has ever completed. A stale hit triggers one deduplicated
 * background re-scan (`after()`); a hit past the 7-day hard ceiling (refreshes failing — repo
 * likely gone) is recomputed inline and the row dropped if the repo no longer scans. Pro-
 * optioned requests (private token / managed LLM) bypass the cache in BOTH directions and are
 * never CDN-cacheable, so a keyed grade cannot leak into the public badge.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> {
  const { slug } = await params;
  const parts = [...slug];
  if (parts.length) parts[parts.length - 1] = (parts[parts.length - 1] as string).replace(/\.svg$/i, "");
  const target = parseSlug(parts);
  if (!target) return new Response("Bad badge path", { status: 400 });

  // A session/entitlements failure must degrade to the anonymous badge, never to a 500 —
  // the response is an <img> in someone's README.
  let opts: ScanOptions = {};
  try {
    opts = await resolveScanOptions(req);
  } catch {
    opts = {};
  }
  const anonymous = !opts.token && !opts.ctx?.model;
  const key = cacheKey(target);

  if (anonymous) {
    const hit = await badgeCache.get(key).catch(() => null);
    if (hit && !isExpired(hit.scannedAt)) {
      if (isStale(hit.scannedAt)) background(() => refreshBadge(target, key));
      return svgResponse(hit.svg, anonymous);
    }
    if (hit) {
      // Expired: a week of failed refreshes. Recompute inline; drop the row if the repo is gone
      // so the badge honestly reads "n/a" instead of advertising a dead repo's last grade.
      const { svg, ok } = await computeBadge(target, {});
      background(() => (ok ? badgeCache.put(key, svg) : badgeCache.delete(key)));
      return svgResponse(svg, anonymous);
    }
  }

  const { svg, ok } = await computeBadge(target, opts);
  // First-ever anonymous render: persist it so every later request is a fast cache hit.
  if (anonymous && ok) background(() => badgeCache.put(key, svg));
  return svgResponse(svg, anonymous);
}
