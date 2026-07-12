import type { Metadata } from "next";
import { allCheckDocs, CATEGORIES } from "@beacon/core";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { MODE_LABELS, kindsLabel } from "./labels";

export const metadata: Metadata = {
  title: "Check reference — every Skill Crossroads check",
  description:
    "What every Skill Crossroads check looks for in a Claude Code skill, subagent, slash command, or MCP config — why it matters, and how to fix a flagged finding.",
  alternates: { canonical: "/docs/checks" },
};

export default function ChecksIndexPage() {
  const entries = allCheckDocs();
  return (
    <main className="wrap">
      <SiteNav current="/docs/checks" />

      <h1>Check reference</h1>
      <p className="lede">
        Every grade is the sum of individual checks — each with file-and-line evidence, a reason it
        matters, and a concrete fix. This page lists all {entries.length} of them, grouped by rubric
        category.
      </p>

      {CATEGORIES.map((cat) => {
        const list = entries.filter((e) => e.category === cat.key);
        if (list.length === 0) return null;
        return (
          <section key={cat.key}>
            <h2>
              {cat.label} <span className="weight">{Math.round(cat.weight * 100)}% of the grade</span>
            </h2>
            <ul className="checks">
              {list.map((e) => (
                <li key={e.id}>
                  <a className="check" href={`/docs/checks/${e.id.toLowerCase()}`}>
                    <code className="cid">{e.id}</code>
                    <span className="ctitle">{e.title}</span>
                    <span className={`mode mode-${e.mode}`}>{MODE_LABELS[e.mode]}</span>
                    <span className="kinds">{kindsLabel(e.appliesTo)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <footer className="foot">
        <p>
          See how your own artifacts score: <a href="/#scan">scan a repo free</a> or run{" "}
          <code>npx skillcrossroads ./my-skill</code>.
        </p>
      </footer>

      <SiteFooter />

      <style>{`
        .wrap{max-width:820px;margin:0 auto;padding:26px 20px 60px}
        h1{font-size:clamp(28px,5vw,40px);letter-spacing:-.02em;font-weight:800;margin-bottom:10px}
        .lede{color:var(--muted);font-size:15.5px;line-height:1.6;margin-bottom:28px;max-width:640px}
        h2{font-size:19px;font-weight:700;margin:30px 0 10px}
        .weight{color:var(--fog);font-weight:500;font-size:13px;margin-left:8px}
        .checks{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
        .check{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 14px;text-decoration:none;color:var(--fg)}
        .check:hover{border-color:var(--accent)}
        .cid{font-weight:700;font-size:13px;color:var(--accent)}
        .ctitle{font-size:14.5px;flex:1;min-width:180px}
        .mode{font-size:11.5px;border-radius:6px;padding:2px 8px;border:1px solid var(--line);color:var(--muted)}
        .kinds{font-size:11.5px;color:var(--fog)}
        .foot{margin-top:40px;color:var(--muted);font-size:14px}
      `}</style>
    </main>
  );
}
