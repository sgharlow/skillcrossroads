import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "How Skill Crossroads handles your code",
  description:
    "Exactly what Skill Crossroads reads, what it stores (scores, never source), and what never leaves your machine — for public scans, private Pro scans, paste-to-scan, and the CLI.",
  alternates: { canonical: "/docs/code-handling" },
};

export default function CodeHandlingPage() {
  return (
    <main className="wrap">
      <SiteNav />

      <h1>How Skill Crossroads handles your code</h1>
      <p className="lede">
        Skill Crossroads reads artifact files to grade them. It stores <strong>results, not
        source</strong>. This page states exactly what is read, what is kept, and what never
        leaves your machine — every claim here matches the open-source code.
      </p>

      <h2>Public repo scans (hosted)</h2>
      <ul className="facts">
        <li>
          Files are fetched from GitHub&apos;s public API, written to a temporary directory for the
          duration of one scan, and <strong>deleted when the scan finishes</strong> — including on
          errors.
        </li>
        <li>
          What we keep: the score record — repo/path, artifact name, letter grade, overall and
          per-category scores, rubric version, and a timestamp — plus a cached copy of the rendered
          badge SVG (a grade, not code). That history powers trend charts and the ecosystem stats.
        </li>
        <li>
          Anonymous scans stay anonymous. If you scan while signed in, your GitHub login is stored
          with the score so <code>/account</code> can show you your own scan history — nothing else.
        </li>
      </ul>

      <h2>Private repo scans (Pro)</h2>
      <ul className="facts">
        <li>
          Private scans read your repo with <strong>your</strong> GitHub OAuth token, read-only.
          The token lives in an HttpOnly cookie in your browser — it is
          <strong> never written to our database</strong>.
        </li>
        <li>
          Private scorecards are served <code>private, no-store</code> — they never enter the
          shared CDN cache. Storage is the same score-only record as public scans.
        </li>
      </ul>

      <h2>Paste-to-scan</h2>
      <ul className="facts">
        <li>
          Pasted artifacts are graded in memory and the scorecard is returned in the same response.
          Pasted content is <strong>not recorded</strong> — no scan-history row, no copy kept.
        </li>
      </ul>

      <h2>LLM-assisted checks</h2>
      <ul className="facts">
        <li>
          <strong>CLI (BYOK):</strong> your Anthropic key stays on your machine — the CLI calls the
          Anthropic API directly. Your key is never sent to skillcrossroads.com. Verdicts are
          cached per-user on your own disk (an OS cache directory, outside the repo).
        </li>
        <li>
          <strong>Hosted managed LLM (Pro):</strong> the artifact text being graded is sent to the
          Anthropic API under our managed key to produce the verdict; verdicts are cached by
          content hash so unchanged artifacts are not re-sent.
        </li>
      </ul>

      <h2>The CLI and <code>--mcp-live</code></h2>
      <ul className="facts">
        <li>
          Local CLI scans read files locally and print locally. Nothing leaves your machine except
          the optional BYOK LLM calls above. The only file the CLI ever writes into a repo is the
          README badge line from <code>skillcrossroads init</code> — shown to you first, never
          committed for you.
        </li>
        <li>
          <code>--mcp-live</code> (spawning your configured MCP servers to grade their tools) is
          CLI-only and opt-in per run. The hosted site never spawns anything from a scanned config —
          by design, not policy.
        </li>
      </ul>

      <h2>Questions</h2>
      <p className="foot-p">
        The scanner, storage layer, and this page live in the open at{" "}
        <a href="https://github.com/sgharlow/skillcrossroads">github.com/sgharlow/skillcrossroads</a> —
        if the code and this page ever disagree, that is a bug; please open an issue.
      </p>

      <SiteFooter />

      <style>{`
        .wrap{max-width:820px;margin:0 auto;padding:26px 20px 60px}
        h1{font-size:clamp(28px,5vw,40px);letter-spacing:-.02em;font-weight:800;margin-bottom:10px}
        .lede{color:var(--muted);font-size:15.5px;line-height:1.6;margin-bottom:28px;max-width:640px}
        h2{font-size:19px;font-weight:700;margin:30px 0 10px}
        .facts{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
        .facts li{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:14.5px;line-height:1.55;color:var(--fg)}
        .facts code{font-size:13px}
        .foot-p{margin-top:8px;color:var(--muted);font-size:14.5px;line-height:1.6}
      `}</style>
    </main>
  );
}
