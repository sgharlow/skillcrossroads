import type { ReactElement } from "react";
import type { Metadata } from "next";
import { CrossroadsBadge, Signpost } from "@/components/CrossroadsBadge";

export const metadata: Metadata = {
  title: "Skill Crossroads scorecard — recipe-001 (C+, FIX)",
  description:
    "A sample Skill Crossroads scorecard: recipe-001 grades C+ (78/100), direction FIX — with evidence-cited fixes ranked by grade impact.",
};

const CATEGORIES: { name: string; score: number }[] = [
  { name: "Correctness & Structure", score: 82 },
  { name: "Triggering & Discoverability", score: 61 },
  { name: "Clarity & Instructions", score: 90 },
  { name: "Token & Context Cost", score: 95 },
  { name: "Safety & Security", score: 80 },
  { name: "Verifiability & Maintainability", score: 55 },
];

const FIXES: { cat: string; evidence: string; impact: string }[] = [
  {
    cat: "Triggering",
    evidence:
      "Description too generic to fire reliably; lead with the use case and add trigger phrases.",
    impact: "+14 → A−",
  },
  {
    cat: "Verifiability",
    evidence: "No evals/ present; add 2–3 test prompts with expected assertions.",
    impact: "+9",
  },
  {
    cat: "Safety",
    evidence: "Skill drafts emails but declares no allowed-tools; scope tools explicitly.",
    impact: "+5",
  },
];

/** Direction band for a 0–100 score: ≥80 ship (green), ≥60 fix (amber), else rethink (red). */
function band(score: number): "ship" | "fix" | "rethink" {
  if (score >= 80) return "ship";
  if (score >= 60) return "fix";
  return "rethink";
}

export default function Scorecard(): ReactElement {
  return (
    <main>
      <header className="nav wrap">
        <a className="brand" href="/">
          <Signpost size={22} />
          <span>Skill Crossroads</span>
        </a>
        <nav className="nav-links">
          <a className="btn btn-sm" href="/#scan">
            Scan your own skill
          </a>
        </nav>
      </header>

      <section className="wrap card-wrap">
        <div className="sc">
          <div className="sc-head">
            <div>
              <p className="sc-kicker">Skill Crossroads scorecard</p>
              <h1 className="sc-title mono">recipe-001</h1>
              <p className="sc-meta">
                overall <strong>C+</strong> (78/100) · rubric v1.0
              </p>
            </div>
            <div className="sc-badge">
              <CrossroadsBadge grade="C+" height={26} />
              <span className="dir-pill dir-fix" role="status">
                Direction: FIX
              </span>
            </div>
          </div>

          <div className="sc-bars">
            {CATEGORIES.map((c) => {
              const dir = band(c.score);
              return (
                <div className="bar-row" key={c.name}>
                  <span className="bar-label">{c.name}</span>
                  <span className="bar-track">
                    <span className={`bar-fill fill-${dir}`} style={{ width: `${c.score}%` }} />
                  </span>
                  <span className="bar-score mono">{c.score}</span>
                </div>
              );
            })}
          </div>

          <div className="sc-fixes">
            <h2>Top fixes — ranked by grade impact</h2>
            <ol>
              {FIXES.map((f) => (
                <li key={f.cat}>
                  <div className="fix-top">
                    <span className="fix-cat">{f.cat}</span>
                    <span className="fix-impact mono">{f.impact}</span>
                  </div>
                  <p className="fix-ev">{f.evidence}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="sc-verdict">
            <span className="verdict-tag">Verdict</span>
            <p>
              Well-written and cheap to run, but as published it will under-trigger and ships without
              evals — the two things that most often make a good skill look broken in someone else&apos;s
              session.
            </p>
          </div>
        </div>

        <div className="sc-cta">
          <p>This is a sample. Point Skill Crossroads at your own artifact and get your direction.</p>
          <a className="btn" href="/#scan">
            Scan a skill — free
          </a>
        </div>
      </section>

      <style>{SC_CSS}</style>
    </main>
  );
}

const SC_CSS = `
.wrap{max-width:840px;margin:0 auto;padding-left:22px;padding-right:22px}
.nav{display:flex;align-items:center;justify-content:space-between;padding-top:22px;padding-bottom:22px}
.brand{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:17px;text-decoration:none;color:var(--fg)}
.nav-links{display:flex;align-items:center;gap:18px}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:600;border-radius:9px;padding:11px 18px;text-decoration:none;font-size:15px;border:1px solid transparent}
.btn:hover{filter:brightness(1.06)}
.btn-sm{padding:8px 14px;font-size:14px}

.card-wrap{padding-bottom:60px}
.sc{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.sc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:26px 26px 22px;border-bottom:1px solid var(--line)}
.sc-kicker{color:var(--muted);font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:600}
.sc-title{font-size:28px;font-weight:700;margin:4px 0 6px}
.sc-meta{color:var(--muted);font-size:14.5px}
.sc-meta strong{color:var(--fix)}
.sc-badge{display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.dir-pill{font-weight:700;font-size:13px;border-radius:20px;padding:5px 14px;border:1px solid}
.dir-fix{color:var(--fix);border-color:color-mix(in srgb, var(--fix) 45%, transparent);background:color-mix(in srgb, var(--fix) 12%, transparent)}

.sc-bars{padding:22px 26px;display:flex;flex-direction:column;gap:13px;border-bottom:1px solid var(--line)}
.bar-row{display:grid;grid-template-columns:1fr 200px 34px;align-items:center;gap:14px}
.bar-label{font-size:14px;color:var(--fg)}
.bar-track{height:9px;border-radius:6px;background:var(--surface-2);overflow:hidden}
.bar-fill{display:block;height:100%;border-radius:6px}
.fill-ship{background:var(--ship)}
.fill-fix{background:var(--fix)}
.fill-rethink{background:var(--rethink)}
.bar-score{text-align:right;font-size:13.5px;font-weight:700;color:var(--muted)}

.sc-fixes{padding:24px 26px;border-bottom:1px solid var(--line)}
.sc-fixes h2{font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:16px}
.sc-fixes ol{list-style:none;display:flex;flex-direction:column;gap:14px}
.sc-fixes li{background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.fix-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.fix-cat{font-weight:650;font-size:15px}
.fix-impact{color:var(--ship);font-weight:700;font-size:13.5px}
.fix-ev{color:var(--muted);font-size:14px;margin-top:6px}

.sc-verdict{padding:22px 26px;display:flex;gap:14px;align-items:flex-start}
.verdict-tag{flex:0 0 auto;color:var(--fix);font-weight:700;text-transform:uppercase;font-size:11.5px;letter-spacing:.08em;margin-top:3px}
.sc-verdict p{color:var(--fg);font-size:15.5px;line-height:1.55}

.sc-cta{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-top:26px;padding:20px 4px}
.sc-cta p{color:var(--muted);font-size:15px;max-width:46ch}

@media(max-width:640px){
  .bar-row{grid-template-columns:1fr 90px 30px}
  .sc-verdict{flex-direction:column;gap:6px}
}
`;
