import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { auditAsync, renderHtml, type ArtifactType } from "@beacon/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Paste size cap — a SKILL.md is prose, not a payload. */
const MAX_BYTES = 200_000;

const HTML = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };

function errorPage(status: number, message: string): Response {
  const esc = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<!doctype html><html lang="en"><body style="font-family:sans-serif;max-width:600px;margin:80px auto;padding:0 20px">
<h1>Couldn't scan that</h1><p>${esc}</p><p><a href="/paste">← back to paste-to-scan</a></p></body></html>`,
    { status, headers: HTML },
  );
}

/**
 * POST /api/scan-paste — paste a SKILL.md / agent / command and get an instant scorecard.
 * Deterministic-only (free tier; no LLM spend on anonymous input). The pasted content is
 * untrusted — the pipeline treats it as such and every renderer escapes it.
 */
export async function POST(req: Request): Promise<Response> {
  let content: string;
  let kindRaw: string;
  try {
    const form = await req.formData();
    content = String(form.get("content") ?? "");
    kindRaw = String(form.get("kind") ?? "skill");
  } catch {
    return errorPage(400, "Expected a form submission with a `content` field.");
  }

  if (!content.trim()) return errorPage(400, "Paste the contents of a SKILL.md (or agent/command .md) first.");
  if (Buffer.byteLength(content, "utf8") > MAX_BYTES) {
    return errorPage(413, "That's over the 200 KB paste limit — scan it locally with `npx skillcrossroads`.");
  }
  const kind: ArtifactType | null =
    kindRaw === "skill" ? "skill" : kindRaw === "agent" ? "subagent" : kindRaw === "command" ? "command" : null;
  if (!kind) return errorPage(400, "kind must be skill, agent, or command.");

  const dir = mkdtempSync(join(tmpdir(), "xr-paste-"));
  try {
    const entry = kind === "skill" ? join(dir, "SKILL.md") : join(dir, "pasted.md");
    writeFileSync(entry, content, "utf8");
    const { scorecard, name } = await auditAsync(kind === "skill" ? dir : entry, {}, kind);
    const html = renderHtml(scorecard, {
      name: kind === "skill" ? name : `${name} [${kind === "subagent" ? "agent" : "command"}]`,
      scannedAt: new Date().toISOString().slice(0, 10),
      homeUrl: "/",
    });
    return new Response(html, { status: 200, headers: HTML });
  } catch (err) {
    return errorPage(422, err instanceof Error ? err.message : String(err));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
