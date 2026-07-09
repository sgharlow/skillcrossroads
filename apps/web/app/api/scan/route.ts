import { parseSlug, scanTarget } from "@/lib/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/scan?repo=owner/repo[/subpath] — JSON scan result. */
export async function GET(req: Request): Promise<Response> {
  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo) return Response.json({ error: "missing ?repo=owner/repo" }, { status: 400 });
  const target = parseSlug(repo.replace(/^https?:\/\/github\.com\//i, "").split("/"));
  if (!target) return Response.json({ error: "bad repo" }, { status: 400 });

  try {
    const scan = await scanTarget(target);
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
