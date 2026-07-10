import { PALETTE, gradeHex, type RepoScanResult } from "@beacon/core";
import { averageScore, averageGrade, type SlugTarget } from "./scan";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A repo-level summary page: every skill in the repo with its grade, linking to each scorecard. */
export function renderRepoSummaryHtml(scan: RepoScanResult, t: SlugTarget, opts: { homeUrl?: string } = {}): string {
  const rows = [...scan.skills].sort((a, b) => b.scorecard.overall - a.scorecard.overall);
  const avg = averageScore(scan);
  const avgGrade = averageGrade(scan);

  const rowHtml = rows
    .map((s) => {
      const color = gradeHex(s.scorecard.grade);
      const href = `/s/${t.owner}/${t.repo}/${s.repoPath}`;
      return `<a class="row" href="${esc(href)}">
        <span class="g" style="color:${color};border-color:${color}">${esc(s.scorecard.grade)}</span>
        <span class="sc">${s.scorecard.overall}</span>
        <span class="nm">${esc(s.name)}</span>
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
.pt{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:${PALETTE.fog}}
.cta-wrap{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-top:22px;padding-top:20px;border-top:1px solid ${PALETTE.ink3}}
.cta-blurb{color:${PALETTE.fog};font-size:13.5px;max-width:52ch}
.cta{display:inline-block;background:${PALETTE.beam};color:#0b1220;font-weight:700;border-radius:10px;padding:11px 20px;text-decoration:none;white-space:nowrap}
a.brand-link{color:inherit;text-decoration:none}
footer{color:${PALETTE.fog};font-size:12px;margin-top:22px;text-align:center}
footer a{color:${PALETTE.fog}}
@media(max-width:520px){.row{grid-template-columns:40px 40px 1fr}.pt{display:none}}
</style></head>
<body><main class="wrap">
  <div class="top"><span class="lamp"></span>${
    opts.homeUrl ? `<a class="brand-link" href="${esc(opts.homeUrl)}"><span class="brand">Skill Crossroads</span></a>` : `<span class="brand">Skill Crossroads</span>`
  }</div>
  <h1>${esc(t.owner)}/${esc(t.repo)}</h1>
  <p class="meta">${rows.length} skills · average <span class="avg">${avgGrade} (${avg}/100)</span> · ref ${esc(scan.ref)} · deterministic</p>
  ${rowHtml}
  ${scan.errors.length ? `<p class="meta">${scan.errors.length} skill(s) could not be scanned.</p>` : ""}
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
