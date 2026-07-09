import type { CategoryScore, CheckResult, Evidence, Scorecard } from "../types.js";
import { PALETTE, gradeHex, statusHex } from "./theme.js";

export interface HtmlOptions {
  /** Artifact display name. */
  name?: string;
  /** ISO date string (e.g. "2026-07-08") shown in the header. Omit to hide. */
  scannedAt?: string;
}

/** Escape text for safe embedding in HTML element content and attribute values. */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The beacon-lamp gauge: an arc whose sweep is the overall score, glowing in its grade color. */
function gauge(card: Scorecard): string {
  const color = gradeHex(card.grade);
  const r = 84;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, card.overall));
  const offset = c * (1 - pct / 100);
  return `<svg class="gauge" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="Overall grade ${esc(card.grade)}, ${card.overall} out of 100">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="100" cy="100" r="${r}" fill="none" stroke="${PALETTE.ink3}" stroke-width="15"/>
  <circle cx="100" cy="100" r="${r}" fill="none" stroke="${color}" stroke-width="15"
    stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
    transform="rotate(-90 100 100)" filter="url(#glow)"/>
  <text x="100" y="98" text-anchor="middle" class="g-grade" fill="${color}">${esc(card.grade)}</text>
  <text x="100" y="128" text-anchor="middle" class="g-score">${card.overall}<tspan class="g-of">/100</tspan></text>
</svg>`;
}

function categoryRow(cat: CategoryScore): string {
  if (!cat.evaluated) {
    return `<div class="cat cat--na">
      <span class="cat-label">${esc(cat.label)}</span>
      <span class="cat-na">not yet scored (v0.1)</span>
    </div>`;
  }
  const score = Math.round(cat.score as number);
  const color = statusHex(cat);
  const summary =
    cat.failCount > 0
      ? `${cat.failCount} fail`
      : cat.warnCount > 0
        ? `${cat.warnCount} warn`
        : "pass";
  return `<div class="cat">
    <span class="cat-label">${esc(cat.label)}</span>
    <span class="cat-bar"><span class="cat-fill" style="width:${score}%;background:${color}"></span></span>
    <span class="cat-score">${score}</span>
    <span class="cat-chip" style="color:${color};border-color:${color}">${summary}</span>
  </div>`;
}

function evidenceBlock(e: Evidence): string {
  const loc = e.line ? `${esc(e.file)}:${e.line}` : esc(e.file);
  const parts: string[] = [`<span class="ev-loc">${loc}</span>`];
  if (e.claimed || e.verified) {
    parts.push(
      `<span class="ev-cv">${e.claimed ? esc(e.claimed) : "—"} <span class="ev-arrow">→</span> ${
        e.verified ? esc(e.verified) : "—"
      }</span>`,
    );
  }
  let html = `<div class="ev"><div class="ev-head">${parts.join("")}</div>`;
  html += `<div class="ev-msg">${esc(e.message)}</div>`;
  if (e.snippet) html += `<pre class="ev-snip">${esc(e.snippet)}</pre>`;
  return html + `</div>`;
}

function fixCard(r: CheckResult): string {
  const isFail = r.status === "fail";
  const color = isFail ? PALETTE.fail : PALETTE.warn;
  const mark = isFail ? "✗" : "⚠";
  const ev = r.evidence.map(evidenceBlock).join("");
  const fix = r.fix ? `<div class="fix-do"><span>Fix</span> ${esc(r.fix)}</div>` : "";
  return `<article class="fix">
    <header class="fix-head">
      <span class="fix-mark" style="color:${color}">${mark}</span>
      <span class="fix-id" style="color:${color}">${esc(r.id)}</span>
      <span class="fix-title">${esc(r.title)}</span>
    </header>
    ${ev}
    ${fix}
  </article>`;
}

function rankFixes(results: readonly CheckResult[]): CheckResult[] {
  return results
    .filter((r) => r.status !== "pass")
    .sort((a, b) => (a.status !== b.status ? (a.status === "fail" ? -1 : 1) : a.score - b.score));
}

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
:root{color-scheme:dark}
body{background:${PALETTE.ink};color:${PALETTE.foam};
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  line-height:1.5;padding:32px 20px;min-height:100vh}
.wrap{max-width:820px;margin:0 auto}
.mono{font-family:ui-monospace,"Cascadia Code","SF Mono",Menlo,Consolas,monospace}
.card{background:${PALETTE.ink2};border:1px solid ${PALETTE.ink3};border-radius:16px;overflow:hidden}
header.top{display:flex;align-items:center;gap:12px;padding:20px 26px;
  border-bottom:1px solid ${PALETTE.ink3};position:relative}
header.top::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120px 80px at 26px 50%,${PALETTE.beam}22,transparent 70%)}
.lamp{width:22px;height:22px;flex:0 0 auto;border-radius:50%;
  background:radial-gradient(circle at 50% 40%,${PALETTE.beam},#b9791f);
  box-shadow:0 0 14px ${PALETTE.beam}99}
.brand{font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:15px}
.top-meta{margin-left:auto;color:${PALETTE.fog};font-size:12.5px;text-align:right}
.top-name{font-weight:600;color:${PALETTE.foam}}
.summary{display:flex;gap:28px;align-items:center;padding:28px 26px;flex-wrap:wrap}
.gauge-wrap{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px}
.gauge{display:block}
.g-grade{font-size:58px;font-weight:800}
.g-score{font-size:20px;font-weight:700;fill:${PALETTE.foam}}
.g-of{font-size:13px;fill:${PALETTE.fog};font-weight:600}
.lamp-cap{color:${PALETTE.fog};font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.cats{flex:1 1 340px;display:flex;flex-direction:column;gap:11px;min-width:280px}
.cat{display:grid;grid-template-columns:1fr 120px 34px 62px;align-items:center;gap:12px}
.cat--na{grid-template-columns:1fr auto}
.cat-label{font-size:13.5px;color:${PALETTE.foam}}
.cat-na{font-size:12px;color:${PALETTE.fog};font-style:italic}
.cat-bar{height:8px;border-radius:5px;background:${PALETTE.ink3};overflow:hidden}
.cat-fill{display:block;height:100%;border-radius:5px}
.cat-score{font-size:13px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.cat-chip{font-size:11px;font-weight:600;text-align:center;border:1px solid;border-radius:20px;padding:2px 0}
.fixes{padding:22px 26px 28px;border-top:1px solid ${PALETTE.ink3}}
.fixes h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${PALETTE.fog};margin-bottom:16px}
.fix{background:${PALETTE.ink};border:1px solid ${PALETTE.ink3};border-radius:12px;padding:14px 16px;margin-bottom:12px}
.fix-head{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.fix-mark{font-weight:700}
.fix-id{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;font-size:13px}
.fix-title{font-weight:600;font-size:14px}
.ev{margin-top:10px;padding-left:12px;border-left:2px solid ${PALETTE.ink3}}
.ev-head{display:flex;gap:10px;flex-wrap:wrap;align-items:baseline}
.ev-loc{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:${PALETTE.beam}}
.ev-cv{font-size:12px;color:${PALETTE.fog}}
.ev-arrow{color:${PALETTE.foam}}
.ev-msg{font-size:13px;color:${PALETTE.foam};margin-top:3px}
.ev-snip{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:${PALETTE.fog};
  background:${PALETTE.ink2};border:1px solid ${PALETTE.ink3};border-radius:7px;
  padding:7px 10px;margin-top:7px;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
.fix-do{margin-top:11px;font-size:13px;color:${PALETTE.foam}}
.fix-do span{color:${PALETTE.pass};font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.08em;margin-right:6px}
.clean{padding:26px;border-top:1px solid ${PALETTE.ink3};color:${PALETTE.pass};font-weight:600}
.note{color:${PALETTE.fog};font-size:12px;margin-top:14px}
footer{text-align:center;color:${PALETTE.fog};font-size:12px;margin-top:20px}
footer a{color:${PALETTE.fog}}
.reveal{opacity:0;transform:translateY(8px);animation:rise .5s ease forwards}
@media (prefers-reduced-motion:reduce){.reveal{animation:none;opacity:1;transform:none}}
@keyframes rise{to{opacity:1;transform:none}}
@media (max-width:560px){.summary{justify-content:center}.cat{grid-template-columns:1fr 70px 30px 54px}}
`;

/** Render a self-contained, shareable HTML scorecard (single file, no external requests). */
export function renderHtml(card: Scorecard, opts: HtmlOptions = {}): string {
  const name = opts.name ?? "artifact";
  const fixes = rankFixes(card.results);
  const llmRan = card.categories.find((c) => c.key === "triggering")?.evaluated ?? false;
  const meta = [
    `rubric v${esc(card.rubricVersion)}`,
    llmRan ? "LLM-assisted" : "deterministic",
    opts.scannedAt ? `scanned ${esc(opts.scannedAt)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const fixesSection =
    fixes.length > 0
      ? `<section class="fixes"><h2>Top fixes — ranked by score impact</h2>${fixes
          .map(fixCard)
          .join("")}</section>`
      : `<section class="clean">✓ No warnings or failures. Clean scan.</section>`;

  const partialNote = card.partial
    ? `<div class="note">Partial grade — some rubric categories have no checks in this version and are excluded from the overall.</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Beacon — ${esc(name)}</title>
<style>${STYLE}</style>
</head>
<body>
<main class="wrap">
  <div class="card reveal">
    <header class="top">
      <span class="lamp" aria-hidden="true"></span>
      <span class="brand">Beacon</span>
      <span class="top-meta"><span class="top-name">${esc(name)}</span><br>${meta}</span>
    </header>
    <section class="summary">
      <div class="gauge-wrap">
        ${gauge(card)}
        <span class="lamp-cap">overall</span>
      </div>
      <div class="cats">
        ${card.categories.map(categoryRow).join("")}
      </div>
    </section>
    ${fixesSection}
    ${partialNote ? `<div class="fixes" style="border-top:none;padding-top:0">${partialNote}</div>` : ""}
  </div>
  <footer>Graded by <strong>Beacon</strong> — Lighthouse for Claude Code artifacts. Evidence-cited, file-and-line. No vibes.</footer>
</main>
</body>
</html>
`;
}
