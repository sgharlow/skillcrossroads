import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Paste-to-scan — grade a skill instantly",
  description:
    "Paste a SKILL.md, subagent, or slash-command file and get an evidence-cited Skill Crossroads scorecard — no GitHub repo required.",
  alternates: { canonical: "/paste" },
};

/** Plain HTML form → POST /api/scan-paste → full scorecard page. Zero client JS. */
export default function PastePage() {
  return (
    <main className="wrap">
      <SiteNav />

      <section className="head">
        <h1>Paste, scan, fix.</h1>
        <p>
          Not on GitHub yet? Paste your <code>SKILL.md</code> (or a subagent / slash-command file)
          and get the evidence-cited scorecard instantly. Deterministic checks only — for the
          LLM-assisted triggering grade, run <code>npx skillcrossroads</code> with your own key.
        </p>
      </section>

      <form method="post" action="/api/scan-paste" className="paste">
        <label htmlFor="content" className="lbl">
          File contents
        </label>
        <textarea
          id="content"
          name="content"
          required
          spellCheck={false}
          placeholder={"---\nname: my-skill\ndescription: …\n---\n\nInstructions…"}
        />
        <div className="row">
          <label htmlFor="kind" className="lbl">
            Kind
          </label>
          <select id="kind" name="kind" defaultValue="skill">
            <option value="skill">Skill (SKILL.md)</option>
            <option value="agent">Subagent (.claude/agents/*.md)</option>
            <option value="command">Slash command (.claude/commands/*.md)</option>
          </select>
          <button type="submit">Scan it</button>
        </div>
      </form>

      <SiteFooter />

      <style>{`
        .wrap{max-width:760px;margin:0 auto;padding:26px 20px 60px}
        .head{padding:30px 0 18px}
        .head h1{font-size:clamp(26px,5vw,38px);font-weight:800;letter-spacing:-.02em;margin-bottom:10px}
        .head p{color:var(--muted);max-width:60ch}
        .head code{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-size:13.5px;font-family:var(--mono)}
        .paste{display:flex;flex-direction:column;gap:12px}
        .lbl{color:var(--muted);font-size:13px;font-weight:600}
        textarea{min-height:320px;background:var(--surface);border:1px solid var(--line);color:var(--fg);
          border-radius:12px;padding:14px;font-size:13.5px;font-family:var(--mono);resize:vertical}
        textarea:focus{outline:none;border-color:var(--accent)}
        .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        select{background:var(--surface);border:1px solid var(--line);color:var(--fg);border-radius:9px;padding:10px 12px;font-size:14px}
        button{background:var(--accent);color:var(--accent-ink);font-weight:700;border:0;border-radius:9px;
          padding:11px 22px;font-size:15px;cursor:pointer;margin-left:auto}
        button:hover{filter:brightness(1.06)}
      `}</style>
    </main>
  );
}
