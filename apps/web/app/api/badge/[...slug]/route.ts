import { renderBadge, type Scorecard } from "@beacon/core";
import { parseSlug, scanTarget, averageGrade } from "@/lib/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/badge/:owner/:repo[/...subpath][.svg] — always-fresh SVG grade badge. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> {
  const { slug } = await params;
  const parts = [...slug];
  if (parts.length) parts[parts.length - 1] = (parts[parts.length - 1] as string).replace(/\.svg$/i, "");
  const target = parseSlug(parts);
  if (!target) return new Response("Bad badge path", { status: 400 });

  let grade = "?";
  try {
    const scan = await scanTarget(target);
    if (scan.skills.length === 1) grade = scan.skills[0]!.scorecard.grade;
    else if (scan.skills.length > 1) grade = averageGrade(scan);
  } catch {
    grade = "?";
  }

  const svg = renderBadge({ grade } as Scorecard, grade === "?" ? { value: "n/a" } : {});
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Always-fresh: re-scans at most every 5 min at the CDN; clients never cache stale.
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
