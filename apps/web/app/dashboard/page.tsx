import type { Metadata } from "next";
import { cookies } from "next/headers";
import { gradeHex, gradeRank } from "@beacon/core";
import { readSessionFromCookieHeader, trustLogin } from "@/lib/session";
import { hasDb, getPool } from "@/lib/db";
import { readDemandConfig, computeDemandMetric, evaluateG0 } from "@beacon/core";
import { scanHistory } from "@/lib/scans";
import { badgeServes, type BadgeServeStats } from "@/lib/badge-serves";
import { SiteNav, SiteFooter } from "@/components/SiteNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Metrics dashboard",
  robots: { index: false },
};

export default async function Dashboard() {
  // Badge stats degrade to null (tile hidden) rather than failing the page — the table may not
  // exist yet on a fresh database, and metrics must never take the dashboard down.
  const [stats, recent, badges] = await Promise.all([
    scanHistory.stats(),
    scanHistory.recent(15),
    badgeServes.stats().catch((): BadgeServeStats | null => null),
  ]);
  // Sort by the canonical grade ranking from @beacon/core (single source of truth — no local copy to drift).
  const gradeRows = Object.entries(stats.byGrade).sort((a, b) => gradeRank(a[0]) - gradeRank(b[0]));
  const maxGrade = Math.max(1, ...gradeRows.map(([, n]) => n));

  // Owner-only demand panel. Never fail the page — degrade to null like the badge tile.
  const demand = await (async () => {
    try {
      const cfg = readDemandConfig(process.env);
      const store = await cookies();
      const header = store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
      const login = trustLogin(readSessionFromCookieHeader(header).login, true);
      if (!login || !cfg.ownerLogins.has(login.toLowerCase()) || !hasDb()) return null;
      const metric = await computeDemandMetric(getPool(), {
        ownerLogins: cfg.ownerLogins,
        launchDate: cfg.launchDate,
        trendDays: cfg.trendDays,
      });
      const verdict = evaluateG0(metric, {
        launchDate: cfg.launchDate,
        launchPosts: cfg.launchPosts,
        now: new Date(),
      });
      return { metric, verdict };
    } catch {
      return null;
    }
  })();

  return (
    <main className="wrap">
      <SiteNav />

      <h1>Metrics</h1>

      {demand && (
        <section className="panel" style={{ borderLeft: "3px solid #888", paddingLeft: "1rem" }}>
          <h2>Demand / G0 gate (owner-only)</h2>
          <p className="muted">{demand.verdict.status.toUpperCase().replace("-", " ")}</p>
          <ul>
            {demand.verdict.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <div className="bars">
            <div>external scans (all-time): {demand.metric.externalScansTotal.toLocaleString()}</div>
            <div>external scans (since launch): {demand.metric.externalScansSinceLaunch.toLocaleString()}</div>
            <div>distinct external logins: {demand.metric.attributedExternalLogins.toLocaleString()}</div>
            <div>anonymous scans: {demand.metric.anonymousScans.toLocaleString()}</div>
            <div>distinct external repos: {demand.metric.distinctExternalRepos.toLocaleString()}</div>
            <div>badge repos via GitHub: {demand.metric.distinctBadgeReposFromGitHub.toLocaleString()}</div>
            <div>gallery opt-ins: {demand.metric.galleryOptIns.toLocaleString()}</div>
            <div>paid subscriptions: {demand.metric.paidSubscriptions.toLocaleString()}</div>
          </div>
        </section>
      )}

      <section className="tiles">
        <div className="tile">
          <div className="n">{stats.totalScans.toLocaleString()}</div>
          <div className="l">scans recorded</div>
        </div>
        <div className="tile">
          <div className="n">{stats.distinctSkills.toLocaleString()}</div>
          <div className="l">skills tracked</div>
        </div>
        {badges !== null && (
          <div className="tile">
            <div className="n">{badges.reposOnGitHub.toLocaleString()}</div>
            <div className="l">badges in the wild ({badges.windowDays}d floor)</div>
            <div className="l sub">
              distinct repos whose badge GitHub rendered; CDN-cached serves aren&apos;t counted
            </div>
          </div>
        )}
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

      <SiteFooter />

      <style>{`
        .wrap{max-width:820px;margin:0 auto;padding:26px 20px 60px}
        h1{font-size:clamp(26px,5vw,38px);font-weight:800;margin:24px 0 18px}
        h2{font-size:14px;color:var(--fog);text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px}
        .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:24px}
        .tile{background:var(--ink2);border:1px solid var(--ink3);border-radius:14px;padding:22px}
        .tile .n{font-size:38px;font-weight:800;font-variant-numeric:tabular-nums}
        .tile .l{color:var(--fog);font-size:13px;margin-top:4px}
        .tile .sub{font-size:11.5px;margin-top:6px;line-height:1.45}
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
