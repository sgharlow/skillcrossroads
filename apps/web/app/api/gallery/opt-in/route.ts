import { after } from "next/server";
import { normalizeSource } from "@beacon/core";
import { parseSlug, scanTarget } from "@/lib/scan";
import { gallery } from "@/lib/gallery";
import { readSession, trustLogin } from "@/lib/session";
import { recordScans } from "@/lib/record";

export const runtime = "nodejs";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The Referer host, but only when it is a different origin than this request (else null). */
function externalRefererHost(req: Request): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    const h = new URL(ref).host;
    return h && h !== new URL(req.url).host ? h : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/gallery/opt-in  { "repo": "owner/repo[/path/to/skill]" }
 * Scans the skill(s) and lists them in the public gallery. Deterministic scan (no key needed).
 */
export async function POST(req: Request): Promise<Response> {
  let repo: string | undefined;
  try {
    const body = (await req.json()) as { repo?: string };
    repo = body.repo;
  } catch {
    /* fall through */
  }
  if (!repo) return Response.json({ error: "missing { repo: 'owner/repo[/path]' }" }, { status: 400 });

  const target = parseSlug(repo.replace(/^https?:\/\/github\.com\//i, "").split("/"));
  if (!target) return Response.json({ error: "bad repo" }, { status: 400 });

  let scan;
  try {
    scan = await scanTarget(target);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "scan failed" }, { status: 502 });
  }
  if (scan.skills.length === 0) {
    return Response.json({ error: `no skills found in ${repo}` }, { status: 404 });
  }

  const entries = [];
  for (const s of scan.skills) {
    entries.push(
      await gallery.add({
        owner: target.owner,
        repo: target.repo,
        path: s.repoPath === "(root)" ? "" : s.repoPath,
        name: s.name,
        grade: s.scorecard.grade,
        overall: s.scorecard.overall,
        scannedAt: today(),
      }),
    );
  }

  // Also record to score-history so gallery opt-ins feed /trends, /dashboard, and (when signed in)
  // /account — matching the /s/ scan path. Best-effort; attributed only to a verified identity.
  const viewer = trustLogin(readSession(req).login, Boolean(process.env.DATABASE_URL)) ?? undefined;
  const source = normalizeSource(new URL(req.url).searchParams.get("ref"), externalRefererHost(req)) ?? undefined;
  after(() => recordScans(target.owner, target.repo, scan.skills, viewer, source));

  return Response.json({ added: entries.length, entries });
}
