import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allCheckDocs, CATEGORIES, type CheckDocEntry } from "@beacon/core";
import { Signpost } from "@/components/CrossroadsBadge";
import { MODE_LABELS, kindsLabel } from "../labels";

export function generateStaticParams(): { id: string }[] {
  return allCheckDocs().map((e) => ({ id: e.id.toLowerCase() }));
}

function findEntry(id: string): CheckDocEntry | undefined {
  const norm = id.toLowerCase();
  return allCheckDocs().find((e) => e.id.toLowerCase() === norm);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const entry = findEntry(id);
  if (!entry) return { title: "Unknown check" };
  return {
    title: `${entry.id} — ${entry.title}`,
    description: entry.docs.why,
    alternates: { canonical: `/docs/checks/${entry.id.toLowerCase()}` },
  };
}

const MODE_BLURBS = {
  deterministic: "Deterministic — runs on every scan, no LLM or network needed.",
  llm: "LLM-assisted — runs with an Anthropic key (BYOK on the CLI, managed on Pro hosted scans).",
  live: "Live introspection — CLI-only, behind the explicit --mcp-live flag.",
} as const;

export default async function CheckDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = findEntry(id);
  if (!entry) notFound();
  const cat = CATEGORIES.find((c) => c.key === entry.category)!;

  return (
    <main className="wrap">
      <header className="nav">
        <a className="brand" href="/">
          <Signpost size={22} />
          <span>Skill Crossroads</span>
        </a>
        <nav className="rlinks">
          <a className="rlink" href="/docs/checks">All checks</a>
          <a className="btn-sm" href="/#scan">Scan a skill</a>
        </nav>
      </header>

      <p className="crumb">
        <a href="/docs/checks">Check reference</a> / {cat.label}
      </p>
      <h1>
        <code className="cid">{entry.id}</code> {entry.title}
      </h1>
      <p className="meta">
        {cat.label} · {Math.round(cat.weight * 100)}% of the grade · {MODE_LABELS[entry.mode]} · applies to{" "}
        {kindsLabel(entry.appliesTo)}
      </p>
      <p className="mode-blurb">{MODE_BLURBS[entry.mode]}</p>

      <section>
        <h2>Why it matters</h2>
        <p>{entry.docs.why}</p>
      </section>

      <section>
        <h2>How to fix it</h2>
        <p>{entry.docs.fix}</p>
      </section>

      {(entry.docs.bad || entry.docs.good) && (
        <section>
          <h2>Example</h2>
          {entry.docs.bad && (
            <div className="ex ex-bad">
              <span className="ex-tag">✗ flagged</span>
              <pre>
                <code>{entry.docs.bad}</code>
              </pre>
            </div>
          )}
          {entry.docs.good && (
            <div className="ex ex-good">
              <span className="ex-tag">✓ passes</span>
              <pre>
                <code>{entry.docs.good}</code>
              </pre>
            </div>
          )}
        </section>
      )}

      <footer className="foot">
        <p>
          Flagged on your artifact? Re-scan after the fix: <a href="/#scan">scan free</a> or{" "}
          <code>npx skillcrossroads ./my-skill</code>. Browse <a href="/docs/checks">all checks</a>.
        </p>
      </footer>

      <style>{`
        .wrap{max-width:820px;margin:0 auto;padding:26px 20px 60px}
        .nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px}
        .brand{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:17px;text-decoration:none;color:var(--fg)}
        .btn-sm{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:600;border-radius:9px;padding:8px 14px;text-decoration:none;font-size:14px}
        .rlinks{display:flex;gap:14px;align-items:center}
        .rlink{color:var(--fog);font-size:13.5px;text-decoration:none}
        .rlink:hover{color:var(--foam)}
        .crumb{font-size:13px;color:var(--fog);margin-bottom:8px}
        .crumb a{color:var(--fog)}
        h1{font-size:clamp(24px,4.5vw,34px);letter-spacing:-.02em;font-weight:800;margin-bottom:8px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
        .cid{color:var(--accent);font-size:.72em}
        .meta{color:var(--muted);font-size:13.5px;margin-bottom:4px}
        .mode-blurb{color:var(--fog);font-size:13px;margin-bottom:24px}
        h2{font-size:18px;font-weight:700;margin:26px 0 8px}
        section p{color:var(--fg);font-size:15.5px;line-height:1.65}
        .ex{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:10px 0;background:var(--surface)}
        .ex-tag{font-size:12px;font-weight:600;display:block;margin-bottom:6px}
        .ex-bad .ex-tag{color:var(--bad, #e5484d)}
        .ex-good .ex-tag{color:var(--good, #30a46c)}
        .ex pre{overflow-x:auto;margin:0}
        .ex code{font-size:13px;line-height:1.5}
        .foot{margin-top:40px;color:var(--muted);font-size:14px}
      `}</style>
    </main>
  );
}
