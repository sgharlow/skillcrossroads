import type { ReactElement } from "react";
import { CrossroadsBadge, Signpost } from "@/components/CrossroadsBadge";
import ScanForm from "./scan-form";

export default function Home(): ReactElement {
  return (
    <main>
      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <header className="nav wrap">
        <a className="brand" href="/">
          <Signpost size={22} />
          <span>Skill Crossroads</span>
        </a>
        <nav className="nav-links">
          <a href="/scorecard">Sample scorecard</a>
          <a href="/gallery">Gallery</a>
          <a href="/pricing">Pricing</a>
          <a href="https://github.com/sgharlow/skillcrossroads">GitHub</a>
          <a className="btn btn-sm" href="#scan">
            Scan a skill
          </a>
        </nav>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="wrap hero">
        <div className="hero-copy">
          <p className="eyebrow">For people who build on Claude Code</p>
          <h1>Every skill hits a crossroads before you ship it.</h1>
          <p className="lede">
            Skill Crossroads grades your Claude Code skills, agents, and MCP servers against an
            evidence-based rubric — then points you one of three ways: ship, fix, or rethink.
          </p>
          <div id="scan">
            <ScanForm />
          </div>
          <div className="cta-row">
            <a className="btn btn-ghost" href="/scorecard">
              See a sample scorecard
            </a>
          </div>
          <p className="hint">
            Not on GitHub? <a href="/paste">Paste a SKILL.md</a> — or scan locally:{" "}
            <code className="mono">npx skillcrossroads ./my-skill</code>
          </p>
        </div>
        <div className="hero-visual" aria-label="A signpost pointing three ways: ship, fix, rethink">
          {/* TODO: replace placeholder — signpost hero illustration */}
          <HeroSignpost />
          <div className="hero-chip">
            <CrossroadsBadge grade="A−" href="/scorecard" />
          </div>
        </div>
      </section>

      {/* ── The three directions ──────────────────────────────────────────── */}
      <section className="wrap block">
        <h2 className="section-h">A grade is a direction, not a gold star.</h2>
        <div className="cards three">
          <article className="card dir dir-ship">
            <span className="dir-tag">Ship</span>
            <span className="dir-grade">A / B</span>
            <p>Your artifact is solid. Embed the badge and release with confidence.</p>
          </article>
          <article className="card dir dir-fix">
            <span className="dir-tag">Fix</span>
            <span className="dir-grade">C / D</span>
            <p>Close, but Skill Crossroads found specific problems — each with the file and line to change.</p>
          </article>
          <article className="card dir dir-rethink">
            <span className="dir-tag">Rethink</span>
            <span className="dir-grade">F</span>
            <p>Deeper issues: it will not trigger, is not safe, or has no way to prove it works.</p>
          </article>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="wrap block">
        <h2 className="section-h">How it works</h2>
        <ol className="steps">
          <li>
            <span className="step-n">1</span>
            <div>
              <h3>Point Skill Crossroads at your artifact.</h3>
              <p>
                <code className="mono">npx skillcrossroads ./my-skill</code>, a repo URL, or your CI.
              </p>
            </div>
          </li>
          <li>
            <span className="step-n">2</span>
            <div>
              <h3>It runs the rubric.</h3>
              <p>
                Fast deterministic checks plus AI-assisted review across six categories — every
                finding cited to a file and line.
              </p>
            </div>
          </li>
          <li>
            <span className="step-n">3</span>
            <div>
              <h3>You get a scorecard, a badge, and a fix list.</h3>
              <p>Ranked by how much each fix raises your grade.</p>
            </div>
          </li>
        </ol>
      </section>

      {/* ── The rubric: six categories ────────────────────────────────────── */}
      <section className="wrap block">
        <h2 className="section-h">What Skill Crossroads checks</h2>
        <div className="cards rubric">
          {RUBRIC.map((r) => (
            <article className="card rubric-item" key={r.title}>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Evidence, not vibes ───────────────────────────────────────────── */}
      <section className="wrap block">
        <div className="receipts">
          <div>
            <h2 className="section-h">Receipts, not vibes.</h2>
            <p className="receipts-body">
              Every finding cites the file and line, and shows what your artifact claims versus what
              Skill Crossroads could verify. No hype, no false confidence — Skill Crossroads will tell you when
              your own skill scores a C, and exactly why.
            </p>
          </div>
          <div className="receipt-demo mono" aria-hidden="true">
            <div className="receipt-row">
              <span className="rc-loc">SKILL.md:1</span>
              <span className="rc-cv">
                claimed “fires on notes” <span className="rc-arrow">→</span> verified: under-triggers
              </span>
            </div>
            <div className="receipt-msg">Description too generic to fire reliably.</div>
            <div className="receipt-fix">Fix: lead with the use case, add trigger phrases. +14 → A−</div>
          </div>
        </div>
      </section>

      {/* ── Wear your grade (the badge / growth loop) ─────────────────────── */}
      <section className="wrap block">
        <h2 className="section-h">Put the signpost in your README.</h2>
        <div className="badge-loop">
          <div>
            <p className="badge-body">
              One line embeds your Skill Crossroads badge. Anyone who sees it can click through to the
              full, evidence-cited scorecard — and run their own. Good work gets shown; the badge
              does the rest.
            </p>
            <div className="badge-preview">
              <CrossroadsBadge grade="A−" href="/scorecard" />
            </div>
          </div>
          <pre className="snippet mono" aria-label="Markdown badge embed snippet">
            {`[![Skill Crossroads: A−](https://skillcrossroads.com/api/badge/OWNER/REPO.svg)](https://skillcrossroads.com/s/OWNER/REPO)`}
          </pre>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section className="wrap block">
        <h2 className="section-h">Pricing</h2>
        <div className="cards three">
          <article className="card price">
            <h3>Free</h3>
            <p>Scan public artifacts and local files, full rubric, local badge. This is the whole tool, in the open.</p>
          </article>
          <article className="card price price-mid">
            <h3>Pro</h3>
            <p>Private repos, hosted always-fresh badges, score history, managed AI checks.</p>
          </article>
          <article className="card price">
            <h3>Team</h3>
            <p>CI quality gate on pull requests, org rules, shared dashboard.</p>
          </article>
        </div>
        <p className="pricing-note">Free covers everything you need to grade and share a public skill.</p>
      </section>

      {/* ── Data report teaser ────────────────────────────────────────────── */}
      <section className="wrap block">
        <div className="teaser card">
          <div>
            <h2 className="section-h teaser-h">The State of Claude Code Skills.</h2>
            <p>
              Skill Crossroads publishes evidence-based reports on what actually makes real skills pass or
              fail across the ecosystem.
            </p>
          </div>
          <a className="btn btn-ghost" href="/report">
            Read the report
          </a>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="wrap foot">
        <div className="foot-cta">
          <div className="brand">
            <Signpost size={20} />
            <span>Skill Crossroads</span>
          </div>
          <a className="btn" href="#scan">
            Scan a skill — free
          </a>
        </div>
        <div className="foot-meta">
          <a href="/scorecard">Sample scorecard</a>
          <a href="/gallery">Gallery</a>
          <a href="/pricing">Pricing</a>
          <a href="/report">Report</a>
          <a href="https://github.com/sgharlow/skillcrossroads">GitHub</a>
          <span className="foot-dom mono">skillcrossroads.com</span>
        </div>
        <p className="foot-line">Know before you ship. The signpost for Claude Code skills, agents, and MCP servers.</p>
      </footer>

      <style>{PAGE_CSS}</style>
    </main>
  );
}

const RUBRIC = [
  {
    title: "Correctness & Structure",
    body: "Valid frontmatter and manifest, resolvable references, nothing pointing at files that do not exist.",
  },
  {
    title: "Triggering & Discoverability",
    body: "Will the model actually invoke it? The number-one reason good skills look broken.",
  },
  {
    title: "Clarity & Instructions",
    body: "Unambiguous, contradiction-free, and phrased as standing instructions.",
  },
  {
    title: "Token & Context Cost",
    body: "What it costs every turn, and whether it uses progressive disclosure.",
  },
  {
    title: "Safety & Security",
    body: "Over-broad tool grants, injection surface, and secrets that should not be there.",
  },
  {
    title: "Verifiability & Maintainability",
    body: "Are there real evals, or tests that only grep the source?",
  },
];

/** Inline signpost illustration for the hero — three arms pointing to the three directions. */
function HeroSignpost(): ReactElement {
  return (
    <svg viewBox="0 0 320 300" width="100%" role="img" aria-label="Signpost pointing to ship, fix, and rethink" className="hero-svg">
      <line x1="160" y1="40" x2="160" y2="280" stroke="var(--line)" strokeWidth="8" strokeLinecap="round" />
      {/* Ship — green, pointing up-right */}
      <g transform="translate(160 96)">
        <path d="M0 -20 H120 L150 0 L120 20 H0 Z" fill="var(--ship)" />
        <text x="66" y="5" textAnchor="middle" fontSize="19" fontWeight="700" fill="#06210f" fontFamily="var(--ui)">
          Ship
        </text>
      </g>
      {/* Fix — amber, pointing right */}
      <g transform="translate(160 150)">
        <path d="M0 -20 H140 L170 0 L140 20 H0 Z" fill="var(--fix)" />
        <text x="76" y="5" textAnchor="middle" fontSize="19" fontWeight="700" fill="#2a1c00" fontFamily="var(--ui)">
          Fix
        </text>
      </g>
      {/* Rethink — red, pointing left */}
      <g transform="translate(160 204)">
        <path d="M0 -20 H-150 L-180 0 L-150 20 H0 Z" fill="var(--rethink)" />
        <text x="-84" y="5" textAnchor="middle" fontSize="19" fontWeight="700" fill="#2a0c0d" fontFamily="var(--ui)">
          Rethink
        </text>
      </g>
      <circle cx="160" cy="40" r="7" fill="var(--fg)" />
    </svg>
  );
}

const PAGE_CSS = `
.wrap{max-width:var(--maxw);margin:0 auto;padding-left:22px;padding-right:22px}
.nav{display:flex;align-items:center;justify-content:space-between;padding-top:22px;padding-bottom:22px}
.brand{display:inline-flex;align-items:center;gap:9px;font-weight:700;letter-spacing:-.01em;font-size:17px;text-decoration:none;color:var(--fg)}
.brand span{font-size:17px}
.nav-links{display:flex;align-items:center;gap:22px}
.nav-links a{color:var(--muted);text-decoration:none;font-size:14.5px}
.nav-links a:hover{color:var(--fg)}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:600;border-radius:9px;padding:11px 18px;text-decoration:none;font-size:15px;border:1px solid transparent;transition:filter .15s}
.btn:hover{filter:brightness(1.06)}
.btn-sm{padding:8px 14px;font-size:14px}
.btn-ghost{background:transparent;color:var(--fg);border-color:var(--line)}
.btn-ghost:hover{border-color:var(--muted);filter:none}

.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center;padding-top:56px;padding-bottom:64px}
.eyebrow{color:var(--muted);font-size:13.5px;letter-spacing:.04em;text-transform:uppercase;font-weight:600;margin-bottom:16px}
h1{font-size:clamp(32px,5vw,52px);line-height:1.06;letter-spacing:-.025em;font-weight:800;margin-bottom:18px}
.lede{color:var(--muted);font-size:18px;max-width:38ch;margin-bottom:26px}
.cta-row{display:flex;gap:12px;flex-wrap:wrap}
.hint{margin-top:20px;color:var(--faint);font-size:14px}
.hint code{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:2px 7px;color:var(--fg)}
.hero-visual{position:relative;display:flex;align-items:center;justify-content:center}
.hero-svg{max-width:340px}
.hero-chip{position:absolute;bottom:6px;right:0}

.block{padding-top:44px;padding-bottom:44px;border-top:1px solid var(--line)}
.section-h{font-size:clamp(22px,3.2vw,30px);letter-spacing:-.02em;font-weight:750;margin-bottom:26px}
.cards{display:grid;gap:16px}
.three{grid-template-columns:repeat(3,1fr)}
.rubric{grid-template-columns:repeat(3,1fr)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:22px}
.card h3{font-size:16px;font-weight:650;margin-bottom:8px}
.card p{color:var(--muted);font-size:14.5px}

.dir{position:relative;border-top:3px solid var(--line)}
.dir-ship{border-top-color:var(--ship)}
.dir-fix{border-top-color:var(--fix)}
.dir-rethink{border-top-color:var(--rethink)}
.dir-tag{font-weight:750;font-size:18px;display:inline-block}
.dir-ship .dir-tag{color:var(--ship)}
.dir-fix .dir-tag{color:var(--fix)}
.dir-rethink .dir-tag{color:var(--rethink)}
.dir-grade{float:right;color:var(--faint);font-size:14px;font-weight:600;font-family:var(--mono)}
.dir p{margin-top:12px;clear:both}

.steps{list-style:none;display:flex;flex-direction:column;gap:6px}
.steps li{display:flex;gap:16px;align-items:flex-start;padding:16px 0;border-bottom:1px solid var(--line)}
.steps li:last-child{border-bottom:none}
.step-n{flex:0 0 auto;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;font-weight:700;font-size:14px;color:var(--muted)}
.steps h3{font-size:16px;font-weight:650;margin-bottom:4px}
.steps p{color:var(--muted);font-size:14.5px}
.steps code{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:1px 6px;color:var(--fg);font-size:13.5px}

.receipts{display:grid;grid-template-columns:1fr 1fr;gap:34px;align-items:center}
.receipts-body{color:var(--muted);font-size:16.5px;max-width:44ch}
.receipt-demo{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius);padding:18px;font-size:13px}
.rc-loc{color:var(--accent)}
.rc-cv{color:var(--muted);margin-left:10px}
.rc-arrow{color:var(--fg)}
.receipt-msg{color:var(--fg);margin-top:10px}
.receipt-fix{color:var(--faint);margin-top:8px}

.badge-loop{display:grid;grid-template-columns:1fr 1fr;gap:34px;align-items:center}
.badge-body{color:var(--muted);font-size:16.5px;max-width:44ch;margin-bottom:18px}
.badge-preview{display:flex}
.snippet{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius);padding:16px;font-size:12.5px;color:var(--fg);overflow-x:auto;white-space:pre}

.pricing-note{margin-top:18px;color:var(--faint);font-size:14.5px;text-align:center}
.price h3{font-size:18px}
.price-mid{border-color:var(--accent)}

.teaser{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.teaser-h{margin-bottom:6px}
.teaser p{color:var(--muted);font-size:15px;max-width:52ch}

.foot{padding-top:40px;padding-bottom:56px;border-top:1px solid var(--line);margin-top:24px}
.foot-cta{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:24px}
.foot-meta{display:flex;align-items:center;gap:22px;flex-wrap:wrap;color:var(--muted);font-size:14px}
.foot-meta a{color:var(--muted);text-decoration:none}
.foot-meta a:hover{color:var(--fg)}
.foot-dom{margin-left:auto;color:var(--faint)}
.foot-line{margin-top:18px;color:var(--faint);font-size:13.5px}

@media(max-width:820px){
  .hero{grid-template-columns:1fr;gap:28px}
  .hero-visual{order:-1}
  .three,.rubric,.receipts,.badge-loop{grid-template-columns:1fr}
  .nav-links a:not(.btn){display:none}
  .foot-dom{margin-left:0}
}
`;
