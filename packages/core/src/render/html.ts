import { percentileLabel } from "../percentile.js";
import { CONFIG_FILENAME } from "../suppress.js";
import { checkDocsUrl } from "../badge-embed.js";
import { usedLlm, type CategoryScore, type CheckResult, type Evidence, type Scorecard } from "../types.js";
import { PALETTE, gradeHex, statusHex } from "./theme.js";

export interface HtmlOptions {
  /** Artifact display name. */
  name?: string;
  /** ISO date string (e.g. "2026-07-08") shown in the header. Omit to hide. */
  scannedAt?: string;
  /**
   * Top-of-funnel URL for the "Scan your own skill" CTA (and the brand/footer links). This closes
   * the badge → scorecard → scan-your-own loop — without it a shared scorecard is a dead end.
   * The CLI passes the site URL; the hosted app passes "/".
   */
  homeUrl?: string;
  /**
   * When set (hosted scorecards), render an "Embed this badge" block with a copy-paste snippet that
   * wraps the always-fresh badge in a link back to this scorecard — the linked badge is the viral
   * primitive. Omitted by the CLI so the local HTML file stays fully self-contained (no requests).
   */
  embed?: { badgeUrl: string; scorecardUrl: string };
  /** Site origin for check-docs links (self-hosting override); defaults to skillcrossroads.com. */
  siteUrl?: string;
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
    // Structurally n/a for this kind (no check can ever score it) vs a real coverage hole.
    const label = cat.applicable === false ? "n/a for this artifact kind" : "not yet scored";
    return `<div class="cat cat--na">
      <span class="cat-label">${esc(cat.label)}</span>
      <span class="cat-na">${label}</span>
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

function fixCard(r: CheckResult, siteUrl?: string): string {
  const isFail = r.status === "fail";
  const color = isFail ? PALETTE.fail : PALETTE.warn;
  const mark = isFail ? "✗" : "⚠";
  const ev = r.evidence.map(evidenceBlock).join("");
  const fix = r.fix ? `<div class="fix-do"><span>Fix</span> ${esc(r.fix)}</div>` : "";
  // The check id links to its reference page (why it matters + how to fix, with examples).
  return `<article class="fix">
    <header class="fix-head">
      <span class="fix-mark" style="color:${color}">${mark}</span>
      <a class="fix-id" style="color:${color}" href="${esc(checkDocsUrl(r.id, siteUrl))}">${esc(r.id)}</a>
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
.fix-id{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;font-size:13px;text-decoration:none}
.fix-id:hover{text-decoration:underline}
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
.brand-link{color:inherit;text-decoration:none}
.cta-wrap{padding:22px 26px 26px;border-top:1px solid ${PALETTE.ink3};display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.cta-blurb{color:${PALETTE.fog};font-size:13.5px;max-width:52ch}
.cta{display:inline-block;background:${PALETTE.beam};color:#0b1220;font-weight:700;border-radius:10px;padding:11px 20px;text-decoration:none;white-space:nowrap}
.cta:hover{filter:brightness(1.08)}
.embed{padding:20px 26px 24px;border-top:1px solid ${PALETTE.ink3}}
.embed h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${PALETTE.fog};margin-bottom:12px}
.embed-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.embed-row img{display:block}
.embed-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:${PALETTE.foam};
  background:${PALETTE.ink};border:1px solid ${PALETTE.ink3};border-radius:8px;padding:10px 12px;overflow-x:auto;white-space:pre}
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
  const meta = [
    `rubric v${esc(card.rubricVersion)}`,
    usedLlm(card) ? "LLM-assisted" : "deterministic",
    opts.scannedAt ? `scanned ${esc(opts.scannedAt)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const fixesSection =
    fixes.length > 0
      ? `<section class="fixes"><h2>Top fixes — ranked by score impact</h2>${fixes
          .map((r) => fixCard(r, opts.siteUrl))
          .join("")}</section>`
      : `<section class="clean">✓ No warnings or failures. Clean scan.</section>`;

  const partialNote = card.partial
    ? `<div class="note">Partial grade — some applicable rubric categories were not scored on this scan (e.g. LLM-assisted checks without a key) and are excluded from the overall.</div>`
    : "";
  // Ecosystem context on full-rubric SKILL scans only — the sample is 214 skills; ranking an
  // agent/command/mcp card against it would overstate (kind defaults to skill for legacy cards).
  const contextNote =
    !card.partial && (card.kind ?? "skill") === "skill"
      ? `<div class="note">★ ${esc(percentileLabel(card.overall))}</div>`
      : "";
  const suppressedNote =
    card.suppressed && card.suppressed.length > 0
      ? `<div class="note">⚠ ${card.suppressed.length} check(s) suppressed via ${CONFIG_FILENAME}: ${card.suppressed
          .map((s) => `${esc(s.id)} (${esc(s.reason)})`)
          .join("; ")}</div>`
      : "";
  const notes = [contextNote, partialNote, suppressedNote].filter(Boolean).join("");

  const brand = opts.homeUrl
    ? `<a class="brand-link" href="${esc(opts.homeUrl)}"><span class="brand">Skill Crossroads</span></a>`
    : `<span class="brand">Skill Crossroads</span>`;

  const ctaSection = opts.homeUrl
    ? `<div class="cta-wrap">
      <span class="cta-blurb">Grade your own Claude Code skill — evidence-cited, file-and-line, free.</span>
      <a class="cta" href="${esc(opts.homeUrl)}">Scan your own skill →</a>
    </div>`
    : "";

  const embedSection = opts.embed
    ? `<section class="embed">
      <h2>Embed this badge</h2>
      <div class="embed-row">
        <a href="${esc(opts.embed.scorecardUrl)}"><img src="${esc(opts.embed.badgeUrl)}" alt="Skill Crossroads grade ${esc(card.grade)}" height="20"></a>
        <span class="cta-blurb">Always-fresh — it re-scans and updates on its own.</span>
      </div>
      <pre class="embed-code">[![Skill Crossroads](${esc(opts.embed.badgeUrl)})](${esc(opts.embed.scorecardUrl)})</pre>
    </section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skill Crossroads — ${esc(name)}</title>
<style>${STYLE}</style>
</head>
<body>
<main class="wrap">
  <div class="card reveal">
    <header class="top">
      <span class="lamp" aria-hidden="true"></span>
      ${brand}
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
    ${notes ? `<div class="fixes" style="border-top:none;padding-top:0">${notes}</div>` : ""}
    ${embedSection}
    ${ctaSection}
  </div>
  <footer>Graded by ${
    opts.homeUrl ? `<a href="${esc(opts.homeUrl)}"><strong>Skill Crossroads</strong></a>` : "<strong>Skill Crossroads</strong>"
  } — the signpost for Claude Code skills, agents, and MCP servers. Evidence-cited, file-and-line.</footer>
</main>
</body>
</html>
`;
}
