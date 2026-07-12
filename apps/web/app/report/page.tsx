import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { REPORT_MD } from "@/content/report";
import { markdownToHtml } from "@/lib/markdown-lite";

export const metadata: Metadata = {
  title: "The State of Claude Code Skills",
  description:
    "An evidence-based audit of 214 public Claude Code skills across 18 repositories, graded by Skill Crossroads — every figure traceable to pinned git trees.",
  alternates: { canonical: "/report" },
};

export default function ReportPage() {
  return (
    <main className="wrap">
      <SiteNav />

      <article className="report" dangerouslySetInnerHTML={{ __html: markdownToHtml(REPORT_MD) }} />

      <footer className="foot">
        <p>
          Companion report: <a href="/report-agents">The State of Claude Code Agents &amp; Commands</a>.
        </p>
        <p>
          Want your skill graded? <a href="/#scan">Scan it free</a> — or run{" "}
          <code>npx skillcrossroads ./my-skill</code> locally.
        </p>
      </footer>

      <SiteFooter />

      <style>{`
        .wrap{max-width:820px;margin:0 auto;padding:26px 20px 60px}
        .report h1{font-size:clamp(28px,5vw,40px);letter-spacing:-.02em;font-weight:800;margin-bottom:14px}
        .report h2{font-size:clamp(20px,3vw,26px);letter-spacing:-.015em;font-weight:750;margin:34px 0 12px}
        .report h3{font-size:17px;font-weight:650;margin:24px 0 10px}
        .report p{color:var(--fg);font-size:15.5px;line-height:1.65;margin-bottom:12px}
        .report em{color:var(--muted)}
        .report blockquote{border-left:3px solid var(--accent);background:var(--surface);border-radius:0 10px 10px 0;padding:12px 16px;margin:14px 0}
        .report blockquote p{margin:0;color:var(--muted);font-size:14.5px}
        .report code{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-size:13.5px;font-family:var(--mono)}
        .report pre{background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:16px;overflow-x:auto;margin:14px 0}
        .report pre code{background:none;border:none;padding:0;font-size:12.5px;line-height:1.5;white-space:pre}
        .report table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
        .report th{text-align:left;color:var(--muted);font-weight:600;padding:8px 10px;border-bottom:2px solid var(--line)}
        .report td{padding:7px 10px;border-bottom:1px solid var(--line)}
        .report ul{margin:0 0 14px 22px;display:flex;flex-direction:column;gap:6px}
        .report li{color:var(--fg);font-size:15px;line-height:1.55}
        .report hr{border:none;border-top:1px solid var(--line);margin:26px 0}
        .foot{margin-top:36px;padding-top:22px;border-top:1px solid var(--line)}
        .foot p{color:var(--muted);font-size:15px}
        .foot a{color:var(--accent)}
        .foot code{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-size:13.5px;font-family:var(--mono)}
      `}</style>
    </main>
  );
}
