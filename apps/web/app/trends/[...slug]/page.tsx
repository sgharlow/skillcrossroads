import type { Metadata } from "next";
import { gradeHex } from "@beacon/core";
import { scanHistory } from "@/lib/scans";
import { trendChartSvg } from "@/lib/chart";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const key = slug.filter(Boolean).join("/");
  return { title: `Score history for ${key}` };
}

export default async function TrendsPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const key = slug.filter(Boolean).join("/");
  const points = await scanHistory.history(key, 100);
  const latest = points[points.length - 1];
  const first = points[0];
  const delta = latest && first ? Math.round((latest.overall - first.overall) * 10) / 10 : 0;

  return (
    <main className="wrap">
      <header className="nav">
        <a className="brand" href="/">
          <span className="lamp" aria-hidden />
          Crossroads
        </a>
        <a className="link" href={`/s/${key}`}>
          View scorecard →
        </a>
      </header>

      <section className="head">
        <p className="eyebrow">Score history</p>
        <h1>
          <code>{key}</code>
        </h1>
        {latest && (
          <p className="now">
            Now <span style={{ color: gradeHex(latest.grade) }}>{latest.grade}</span> ({latest.overall}/100)
            {points.length > 1 && (
              <span className="delta" style={{ color: delta >= 0 ? "#35d0a5" : "#ff6b6b" }}>
                {" "}
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} since {first!.scannedAt.slice(0, 10)}
              </span>
            )}
          </p>
        )}
      </section>

      {points.length === 0 ? (
        <p className="empty">
          No history yet. Every scan of <code>{key}</code> is recorded — <a href={`/s/${key}`}>scan it</a> to start
          tracking quality over time.
        </p>
      ) : (
        <>
          <div className="chart" dangerouslySetInnerHTML={{ __html: trendChartSvg(points) }} />
          <table className="pts">
            <thead>
              <tr>
                <th>Scanned</th>
                <th>Grade</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().slice(0, 12).map((p, i) => (
                <tr key={i}>
                  <td className="mono">{p.scannedAt.slice(0, 16).replace("T", " ")}</td>
                  <td style={{ color: gradeHex(p.grade) }}>{p.grade}</td>
                  <td className="mono">{p.overall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <style>{`
        .wrap{max-width:760px;margin:0 auto;padding:26px 20px 60px}
        .nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:15px;text-decoration:none}
        .lamp{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 50% 40%,var(--beam),#b9791f);box-shadow:0 0 14px #ffc24b99}
        .link{color:var(--aqua);font-size:13.5px;text-decoration:none}
        .head{padding:30px 0 16px}
        .eyebrow{color:var(--beam);font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600}
        h1{margin-top:8px;font-size:clamp(20px,3.5vw,28px);font-weight:700;word-break:break-all}
        h1 code{font-family:ui-monospace,Menlo,Consolas,monospace}
        .now{color:var(--fog);margin-top:10px}
        .now span{font-weight:700}
        .delta{font-weight:600}
        .chart{background:var(--ink2);border:1px solid var(--ink3);border-radius:14px;padding:12px 8px;margin:8px 0 20px}
        .pts{width:100%;border-collapse:collapse;font-size:13.5px}
        .pts th{text-align:left;color:var(--fog);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--ink3)}
        .pts td{padding:8px 10px;border-bottom:1px solid var(--ink3)}
        .mono{font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--foam)}
        .empty{color:var(--fog);padding:40px 0;text-align:center}
        .empty a{color:var(--aqua)}
        code{background:var(--ink2);border:1px solid var(--ink3);border-radius:5px;padding:1px 5px}
      `}</style>
    </main>
  );
}
