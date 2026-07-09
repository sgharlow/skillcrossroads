import type { Metadata } from "next";
import { gradeHex, gradeRank } from "@beacon/core";
import { scanHistory } from "@/lib/scans";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beacon — metrics dashboard",
  robots: { index: false },
};

export default async function Dashboard() {
  const [stats, recent] = await Promise.all([scanHistory.stats(), scanHistory.recent(15)]);
  // Sort by the canonical grade ranking from @beacon/core (single source of truth — no local copy to drift).
  const gradeRows = Object.entries(stats.byGrade).sort((a, b) => gradeRank(a[0]) - gradeRank(b[0]));
  const maxGrade = Math.max(1, ...gradeRows.map(([, n]) => n));

  return (
    <main className="wrap">
      <header className="nav">
        <a className="brand" href="/">
          <span className="lamp" aria-hidden />
          Beacon
        </a>
        <a className="link" href="/gallery">
          Gallery →
        </a>
      </header>

      <h1>Metrics</h1>

      <section className="tiles">
        <div className="tile">
          <div className="n">{stats.totalScans.toLocaleString()}</div>
          <div className="l">scans recorded</div>
        </div>
        <div className="tile">
          <div className="n">{stats.distinctSkills.toLocaleString()}</div>
          <div className="l">skills tracked</div>
        </div>
      </section>

      <section className="panel">
        <h2>Current grade distribution</h2>
        {gradeRows.length === 0 ? (
          <p className="muted">No scans yet.</p>
        ) : (
          <div className="bars">
            {gradeRows.map(([grade, n]) => (
              <div className="bar" key={grade}>
                <span className="g" style={{ color: gradeHex(grade) }}>
                  {grade}
                </span>
                <span className="track">
                  <span className="fill" style={{ width: `${(n / maxGrade) * 100}%`, background: gradeHex(grade) }} />
                </span>
                <span className="c">{n}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Recent scans</h2>
        {recent.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="recent">
            {recent.map((r, i) => (
              <li key={i}>
                <a href={`/trends/${r.slug}`}>
                  <span className="g" style={{ color: gradeHex(r.grade) }}>
                    {r.grade}
                  </span>
                  <span className="sc">{r.overall}</span>
                  <span className="nm">{r.name}</span>
                  <span className="sl">{r.slug}</span>
                  <span className="dt">{r.scannedAt.slice(0, 16).replace("T", " ")}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style>{`
        .wrap{max-width:820px;margin:0 auto;padding:26px 20px 60px}
        .nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:15px;text-decoration:none}
        .lamp{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 50% 40%,var(--beam),#b9791f);box-shadow:0 0 14px #ffc24b99}
        .link{color:var(--aqua);font-size:13.5px;text-decoration:none}
        h1{font-size:clamp(26px,5vw,38px);font-weight:800;margin:24px 0 18px}
        h2{font-size:14px;color:var(--fog);text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px}
        .tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:24px}
        .tile{background:var(--ink2);border:1px solid var(--ink3);border-radius:14px;padding:22px}
        .tile .n{font-size:38px;font-weight:800;font-variant-numeric:tabular-nums}
        .tile .l{color:var(--fog);font-size:13px;margin-top:4px}
        .panel{background:var(--ink2);border:1px solid var(--ink3);border-radius:14px;padding:20px;margin-bottom:16px}
        .muted{color:var(--fog)}
        .bars{display:flex;flex-direction:column;gap:8px}
        .bar{display:grid;grid-template-columns:32px 1fr 34px;align-items:center;gap:10px}
        .bar .g{font-weight:700;font-size:13px}
        .track{height:10px;border-radius:6px;background:var(--ink3);overflow:hidden}
        .fill{display:block;height:100%;border-radius:6px}
        .bar .c{text-align:right;font-variant-numeric:tabular-nums;font-size:13px}
        .recent{list-style:none;display:flex;flex-direction:column;gap:7px}
        .recent a{display:grid;grid-template-columns:34px 40px 1fr auto;gap:10px;align-items:center;text-decoration:none;color:inherit;padding:8px 6px;border-bottom:1px solid var(--ink3)}
        .recent a:hover{background:#ffffff08}
        .recent .g{font-weight:700;text-align:center}
        .recent .sc{font-weight:700;font-variant-numeric:tabular-nums}
        .recent .nm{font-weight:600}
        .recent .sl{grid-column:3;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:var(--fog)}
        .recent .dt{font-size:11px;color:var(--fog);font-family:ui-monospace,Menlo,Consolas,monospace}
        @media(max-width:560px){.recent .sl{display:none}}
      `}</style>
    </main>
  );
}
