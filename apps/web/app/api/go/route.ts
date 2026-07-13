import { resolveRepoSlug } from "@/lib/repo-slug";

export const dynamic = "force-dynamic";

/**
 * GET /api/go?repo=owner/repo — the no-JS fallback for the homepage scan form. With JS enabled,
 * `scan-form.tsx` intercepts the submit (`preventDefault` + `router.push`) and this route is never
 * hit; with JS disabled the browser's native form GET lands here instead, so the primary CTA still
 * works. Always redirects to a path this handler itself constructs — never to caller-supplied text
 * — so there is no open-redirect surface regardless of what `repo` contains.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const repo = url.searchParams.get("repo") ?? "";
  const slug = resolveRepoSlug(repo);
  const location = slug ? `/s/${slug}` : "/?error=bad-repo";
  return Response.redirect(new URL(location, url.origin), 302);
}
