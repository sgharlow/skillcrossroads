import { renderBadge, type Scorecard } from "@beacon/core";
import { parseSlug, scanTarget, averageGrade } from "@/lib/scan";
import { resolveScanOptions } from "@/lib/pro-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/badge/:owner/:repo[/...subpath][.svg] — always-fresh SVG grade badge. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> {
  const { slug } = await params;
  const parts = [...slug];
  if (parts.length) parts[parts.length - 1] = (parts[parts.length - 1] as string).replace(/\.svg$/i, "");
  const target = parseSlug(parts);
  if (!target) return new Response("Bad badge path", { status: 400 });

  let card: Scorecard | null = null;
  let grade = "?";
  try {
    const scan = await scanTarget(target, await resolveScanOptions(req));
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

  const svg =
    grade === "?"
      ? renderBadge({ grade } as Scorecard, { value: "n/a" })
      : renderBadge(card ?? ({ grade } as Scorecard));
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Always-fresh: re-scans at most every 5 min at the CDN; clients never cache stale.
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
