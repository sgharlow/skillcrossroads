import { PALETTE, gradeHex, badgeMarkdownLine, type RepoScanResult } from "@beacon/core";
import { averageScore, averageGrade, type SlugTarget } from "./scan";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Honest count line: "21 artifacts (18 skills · 3 agents)" — never blend kinds into "skills". */
function countLabel(rows: readonly { artifact: { type: string } }[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.artifact.type, (counts.get(r.artifact.type) ?? 0) + 1);
  if (counts.size === 1 && counts.has("skill")) return `${rows.length} skills`;
  const label = (t: string): string =>
    t === "skill" ? "skills" : t === "subagent" ? "agents" : t === "command" ? "commands" : t === "plugin" ? "plugins" : "mcp configs";
  const parts = [...counts.entries()].map(([t, n]) => `${n} ${label(t)}`);
  return `${rows.length} artifacts (${parts.join(" · ")})`;
}

/**
 * Scorecard link for one summary row. Plugin rows deep-link to the manifest FILE path
 * (`…/<pluginRoot>/.claude-plugin/plugin.json`) — the exact-file path that rescans to exactly
 * the plugin row. Linking the plugin ROOT would 404 (no SKILL.md there) or rescan the subtree
 * into multiple rows, leaving the plugin scorecard unreachable. `(root)` marks a repo-root plugin.
 */
export function rowHref(t: SlugTarget, row: { repoPath: string; artifact: { type: string } }): string {
  if (row.artifact.type === "plugin") {
    const root = row.repoPath === "(root)" ? "" : `${row.repoPath}/`;
    return `/s/${t.owner}/${t.repo}/${root}.claude-plugin/plugin.json`;
  }
  return `/s/${t.owner}/${t.repo}/${row.repoPath}`;
}

export interface RepoSummaryOptions {
  homeUrl?: string;
  /**
   * When set (hosted repo-summary pages), render an "Embed this badge" block for the repo's own
   * badge — same contract as the single-artifact scorecard, sourced from `badge-embed.ts` so the
   * markdown line is never re-typed.
   */
  embed?: { badgeUrl: string; scorecardUrl: string };
}

/** A repo-level summary page: every skill in the repo with its grade, linking to each scorecard. */
export function renderRepoSummaryHtml(scan: RepoScanResult, t: SlugTarget, opts: RepoSummaryOptions = {}): string {
  const rows = [...scan.skills].sort((a, b) => b.scorecard.overall - a.scorecard.overall);
  const avg = averageScore(scan);
  const avgGrade = averageGrade(scan);

  const rowHtml = rows
    .map((s) => {
      const color = gradeHex(s.scorecard.grade);
      const href = rowHref(t, s);
      return `<a class="row" href="${esc(href)}">
        <span class="g" style="color:${color};border-color:${color}">${esc(s.scorecard.grade)}</span>
        <span class="sc">${s.scorecard.overall}</span>
        <span class="nm">${esc(s.name)}${
          s.artifact.type !== "skill"
            ? ` <span class="kind">[${s.artifact.type === "subagent" ? "agent" : esc(s.artifact.type)}]</span>`
            : ""
        }</span>
        <span class="pt">${esc(s.repoPath)}</span>
      </a>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skill Crossroads — ${esc(t.owner)}/${esc(t.repo)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}:root{color-scheme:dark}
body{background:${PALETTE.ink};color:${PALETTE.foam};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:32px 20px;line-height:1.5}
.wrap{max-width:760px;margin:0 auto}
.top{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.lamp{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 50% 40%,${PALETTE.beam},#b9791f);box-shadow:0 0 14px ${PALETTE.beam}99}
.brand{font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:14px}
h1{font-size:20px;margin:14px 0 2px;font-weight:700}
.meta{color:${PALETTE.fog};font-size:13px;margin-bottom:20px}
.avg{display:inline-block;font-weight:800;color:${gradeHex(avgGrade)};font-size:15px}
.row{display:grid;grid-template-columns:44px 46px 1fr auto;gap:12px;align-items:center;text-decoration:none;color:inherit;
  background:${PALETTE.ink2};border:1px solid ${PALETTE.ink3};border-radius:10px;padding:11px 14px;margin-bottom:9px}
.row:hover{border-color:${PALETTE.beam}66}
.g{font-weight:700;text-align:center;border:1px solid;border-radius:16px;padding:2px 0;font-size:13px}
.sc{font-weight:700;font-variant-numeric:tabular-nums;text-align:right}
.nm{font-weight:600}
.kind{color:${PALETTE.fog};font-size:11px;font-weight:500}
.pt{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:${PALETTE.fog}}
.cta-wrap{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-top:22px;padding-top:20px;border-top:1px solid ${PALETTE.ink3}}
.cta-blurb{color:${PALETTE.fog};font-size:13.5px;max-width:52ch}
.cta{display:inline-block;background:${PALETTE.beam};color:#0b1220;font-weight:700;border-radius:10px;padding:11px 20px;text-decoration:none;white-space:nowrap}
a.brand-link{color:inherit;text-decoration:none}
.embed{margin-top:22px;padding-top:20px;border-top:1px solid ${PALETTE.ink3}}
.embed h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${PALETTE.fog};margin-bottom:12px}
.embed-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.embed-row img{display:block}
.embed-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:${PALETTE.foam};
  background:${PALETTE.ink};border:1px solid ${PALETTE.ink3};border-radius:8px;padding:10px 12px;overflow-x:auto;white-space:pre}
.embed-copy{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap}
.embed-copy .embed-code{flex:1 1 auto;margin:0}
.copy-btn{background:${PALETTE.ink3};color:${PALETTE.foam};border:1px solid ${PALETTE.ink3};border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;white-space:nowrap}
.copy-btn:hover{filter:brightness(1.15)}
.embed-hint{color:${PALETTE.fog};font-size:12.5px;margin-top:10px}
.embed-hint code{font-family:ui-monospace,Menlo,Consolas,monospace;color:${PALETTE.foam};background:${PALETTE.ink};border:1px solid ${PALETTE.ink3};border-radius:6px;padding:1px 6px}
footer{color:${PALETTE.fog};font-size:12px;margin-top:22px;text-align:center}
footer a{color:${PALETTE.fog}}
@media(max-width:520px){.row{grid-template-columns:40px 40px 1fr}.pt{display:none}}
</style></head>
<body><main class="wrap">
  <div class="top"><span class="lamp"></span>${
    opts.homeUrl ? `<a class="brand-link" href="${esc(opts.homeUrl)}"><span class="brand">Skill Crossroads</span></a>` : `<span class="brand">Skill Crossroads</span>`
  }</div>
  <h1>${esc(t.owner)}/${esc(t.repo)}</h1>
  <p class="meta">${countLabel(rows)} · average <span class="avg">${avgGrade} (${avg}/100)</span> · ref ${esc(scan.ref)} · deterministic</p>
  ${rowHtml}
  ${scan.errors.length ? `<p class="meta">${scan.errors.length} skill(s) could not be scanned.</p>` : ""}
  ${
    opts.embed
      ? `<section class="embed">
      <h2>Embed this badge</h2>
      <div class="embed-row">
        <a href="${esc(opts.embed.scorecardUrl)}"><img src="${esc(opts.embed.badgeUrl)}" alt="Skill Crossroads grade ${esc(avgGrade)}" height="20"></a>
        <span class="cta-blurb">Always-fresh — it re-scans and updates on its own.</span>
      </div>
      <div class="embed-copy">
        <pre class="embed-code">${esc(badgeMarkdownLine(opts.embed))}</pre>
        <button type="button" class="copy-btn">Copy</button>
      </div>
      <script>
(function(){var b=document.querySelector('.copy-btn'),p=document.querySelector('.embed-code');if(!b||!p||!navigator.clipboard)return;b.addEventListener('click',function(){navigator.clipboard.writeText(p.textContent).then(function(){var o=b.textContent;b.textContent='Copied!';setTimeout(function(){b.textContent=o;},1500);});});})();
</script>
      <p class="embed-hint">or run <code>npx skillcrossroads init</code> in your repo to insert it into your README.</p>
    </section>`
      : ""
  }
  ${
    opts.homeUrl
      ? `<div class="cta-wrap"><span class="cta-blurb">Grade your own Claude Code skill — evidence-cited, file-and-line, free.</span><a class="cta" href="${esc(opts.homeUrl)}">Scan your own skill →</a></div>`
      : ""
  }
  <footer>Graded by ${
    opts.homeUrl ? `<a href="${esc(opts.homeUrl)}"><strong>Skill Crossroads</strong></a>` : "<strong>Skill Crossroads</strong>"
  } — the signpost for Claude Code skills, agents, and MCP servers.</footer>
</main></body></html>`;
}
