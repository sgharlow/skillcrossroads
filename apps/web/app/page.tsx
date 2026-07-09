import ScanForm from "./scan-form";

export default function Home() {
  return (
    <main className="wrap">
      <header className="nav">
        <span className="brand">
          <span className="lamp" aria-hidden />
          Beacon
        </span>
        <nav className="links">
          <a href="/gallery">Gallery</a>
          <a href="/pricing">Pricing</a>
          <a className="ghlink" href="/api/auth/github">
            Sign in with GitHub
          </a>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">Lighthouse for Claude Code artifacts</p>
        <h1>
          Prove your skill is good
          <br />
          before you ship it.
        </h1>
        <p className="sub">
          Beacon audits a Claude Code skill — structure, triggering, token cost, and safety — and returns an
          evidence-cited scorecard with a letter grade. File-and-line receipts. No vibes.
        </p>
        <ScanForm />
        <p className="hint">
          Scan any public repo, or run it locally: <code className="mono">npx beacon ./my-skill</code>
        </p>
      </section>

      <section className="cards">
        <div className="card">
          <h3>Shareable scorecard</h3>
          <p>Every scan is a public URL you can send — a Lighthouse-style grade dial, category bars, and ranked fixes.</p>
        </div>
        <div className="card">
          <h3>Embeddable badge</h3>
          <p>
            Drop an always-fresh <span className="mono">Beacon: A−</span> badge in your README. It updates every time you
            re-scan.
          </p>
        </div>
        <div className="card">
          <h3>Catches the real failures</h3>
          <p>“My skill never triggers,” a hardcoded key, an over-broad tool grant, token bloat — before anyone else sees it.</p>
        </div>
      </section>

      <footer className="foot">
        Evidence-cited grades. File-and-line receipts. No vibes. · <a href="/s/anthropics/skills">See a live example →</a>
      </footer>

      <style>{`
        .wrap{max-width:900px;margin:0 auto;padding:26px 20px 60px}
        .nav{display:flex;align-items:center;justify-content:space-between}
        .brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:15px}
        .lamp{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 50% 40%,var(--beam),#b9791f);box-shadow:0 0 14px #ffc24b99}
        .links{display:flex;align-items:center;gap:16px}
        .links>a{font-size:13.5px;color:var(--fog);text-decoration:none}
        .ghlink{border:1px solid var(--ink3);border-radius:8px;padding:8px 14px}
        .links>a:hover{border-color:var(--beam);color:var(--foam)}
        .hero{text-align:center;padding:64px 0 40px;position:relative}
        .hero::before{content:"";position:absolute;inset:-40px 0 auto;height:220px;pointer-events:none;
          background:radial-gradient(420px 160px at 50% 0,#ffc24b1f,transparent 70%)}
        .eyebrow{color:var(--beam);font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:600}
        h1{font-size:clamp(34px,6vw,56px);line-height:1.05;font-weight:800;margin:14px 0 18px;letter-spacing:-.02em}
        .sub{color:var(--fog);font-size:17px;max-width:620px;margin:0 auto}
        .hint{color:var(--fog);font-size:13.5px;margin-top:18px}
        .hint code{background:var(--ink2);border:1px solid var(--ink3);border-radius:6px;padding:2px 7px;color:var(--foam)}
        .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px}
        .card{background:var(--ink2);border:1px solid var(--ink3);border-radius:14px;padding:20px}
        .card h3{font-size:16px;margin-bottom:8px}
        .card p{color:var(--fog);font-size:14px}
        .foot{text-align:center;color:var(--fog);font-size:13px;margin-top:40px}
        .foot a{color:var(--aqua);text-decoration:none}
        @media(max-width:640px){.cards{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
