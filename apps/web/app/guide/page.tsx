import type { Metadata } from "next";
import { Signpost } from "@/components/CrossroadsBadge";

export const metadata: Metadata = {
  title: "Guide — five journeys from first scan to shipped badge",
  description:
    "The new-user guide to Skill Crossroads: scan a repo free, fix from evidence-cited receipts, badge your README, paste-to-scan, and gate PRs in CI — each with a real screenshot and the exact command.",
  alternates: { canonical: "/guide" },
};

interface Journey {
  id: string;
  kicker: string;
  title: string;
  why: React.ReactNode;
  doSteps: React.ReactNode[];
  getItems: React.ReactNode[];
  cmd?: React.ReactNode;
  shotUrl: string;
  shotSrc: string;
  shotAlt: string;
  cap?: React.ReactNode;
}

const JOURNEYS: Journey[] = [
  {
    id: "scan",
    kicker: "First contact",
    title: "Scan any public repo — free, no signup.",
    why: (
      <>
        The homepage is the product. Type any GitHub <code>owner/repo</code> that contains Claude
        Code artifacts and you get a graded scorecard for everything in it — yours or anyone&apos;s,
        before you install it.
      </>
    ),
    doSteps: [
      <>Go to <strong>skillcrossroads.com</strong></>,
      <>Enter <code>owner/repo</code> (try <code>anthropics/skills</code>)</>,
      <>Press <strong>Scan</strong></>,
    ],
    getItems: [
      <>A letter grade per artifact and for the repo</>,
      <>Six rubric categories, weighted and scored</>,
      <><em>No account, no key, no install — deterministic checks run free</em></>,
    ],
    cmd: (
      <>
        <span className="c"># the same journey in the terminal — no clone needed</span>
        {"\n"}npx skillcrossroads anthropics/skills
      </>
    ),
    shotUrl: "skillcrossroads.com",
    shotSrc: "/guide/j1-homepage.png",
    shotAlt:
      "Skill Crossroads homepage: headline 'Every skill hits a crossroads before you ship it', a scan form accepting owner/repo, and the ship / fix / rethink signpost",
  },
  {
    id: "fix",
    kicker: "The core loop",
    title: "Read the scorecard — then fix from receipts, not vibes.",
    why: (
      <>
        Every finding is cited to a file and line, with the evidence quoted and a concrete fix. The
        &ldquo;Top fixes&rdquo; list is ranked by grade impact, so ten minutes of work goes where it
        moves the score most. Each check links to its own <a href="/docs/checks">reference page</a>.
      </>
    ),
    doSteps: [
      <>Open the top fix — it names the exact <code>file:line</code></>,
      <>Apply the smallest change that resolves it</>,
      <>Re-scan; repeat until the grade stops improving</>,
    ],
    getItems: [
      <>Grade dial + six category bars</>,
      <>Evidence-cited findings with fix guidance</>,
      <>
        <em>
          With an API key, <code>--suggest</code> proposes the fixes for you — never auto-applies
        </em>
      </>,
    ],
    cmd: (
      <>
        <span className="c"># real output — three skills, after one fix pass</span>
        {"\n"}$ npx skillcrossroads ./skills{"\n\n"}
        {"  "}<span className="g">A+   97.2</span>  meeting-notes-to-actions{"\n"}
        {"  "}<span className="g">A    96.7</span>  summarize-document{"\n"}
        {"  "}<span className="g">A      96</span>  research-synthesis{"\n\n"}
        {"  "}average <span className="y">96.6/100</span> across 3 skills
      </>
    ),
    shotUrl: "skillcrossroads.com/s/sgharlow/skillcrossroads/skill",
    shotSrc: "/guide/j2-scorecard.png",
    shotAlt:
      "A live scorecard: overall grade A 96.3, six category bars, and a Top Fixes list where each finding cites SKILL.md line numbers with quoted evidence and a fix",
    cap: (
      <>
        This scorecard is live:{" "}
        <a href="/s/sgharlow/skillcrossroads/skill">skillcrossroads.com/s/sgharlow/skillcrossroads/skill</a>
      </>
    ),
  },
  {
    id: "badge",
    kicker: "Show your work",
    title: "Put the live badge in your README.",
    why: (
      <>
        One command inserts an always-fresh badge under your README&apos;s title — it re-scans on
        its own, links to your public scorecard, and tells everyone who lands on your repo that the
        quality claim is checkable. The CLI never commits; you review the diff and push.
      </>
    ),
    doSteps: [
      <>In your repo: <code>npx skillcrossroads init</code></>,
      <>Review the one-line README diff</>,
      <>Commit and push</>,
    ],
    getItems: [
      <>A live grade badge that stays current with no further action</>,
      <>A click-through to your evidence-cited scorecard</>,
      <><em>The badge is how good work gets discovered — this is the loop</em></>,
    ],
    cmd: (
      <>
        $ npx skillcrossroads init --dry-run   <span className="c"># preview first</span>
        {"\n"}$ npx skillcrossroads init             <span className="c"># inserts the badge under your H1</span>
      </>
    ),
    shotUrl: "github.com/sgharlow/claude-code-recipes",
    shotSrc: "/guide/j3-badge-readme2.png",
    shotAlt:
      "A GitHub README titled 'Top 100 Claude Code Recipes' with the Skill Crossroads A+ badge rendered directly under the heading",
  },
  {
    id: "paste",
    kicker: "No repo? no problem",
    title: "Paste, scan, fix — before the repo exists.",
    why: (
      <>
        Drafting a skill in an editor and not on GitHub yet? Paste the <code>SKILL.md</code> (or a
        subagent / slash-command file) and get the scorecard instantly. Pasted content is graded in
        memory and never stored — see <a href="/docs/code-handling">how we handle your code</a>.
      </>
    ),
    doSteps: [
      <>Open <a href="/paste">skillcrossroads.com/paste</a></>,
      <>Paste the file, pick the artifact kind</>,
      <>Press <strong>Scan it</strong></>,
    ],
    getItems: [
      <>The same evidence-cited scorecard, instantly</>,
      <>Deterministic checks — free, keyless</>,
      <><em>Nothing recorded: paste-to-scan keeps no copy</em></>,
    ],
    shotUrl: "skillcrossroads.com/paste",
    shotSrc: "/guide/j4-paste.png",
    shotAlt:
      "The paste-to-scan page: 'Paste, scan, fix.' with a file-contents textarea, an artifact-kind selector, and a Scan It button",
  },
  {
    id: "ci",
    kicker: "Keep it good",
    title: "Gate pull requests in CI.",
    why: (
      <>
        The GitHub Action scans on every PR, posts the scorecard as a comment (updated in place,
        with inline file:line annotations), and can fail the build when any artifact grades below
        your bar. Quality stops regressing the day you add one workflow file — and the Action is
        free.
      </>
    ),
    doSteps: [
      <>Add the workflow below to <code>.github/workflows/</code></>,
      <>Open a PR that touches a skill</>,
      <>Read the scorecard comment; merge when green</>,
    ],
    getItems: [
      <>A scorecard comment on every PR</>,
      <>Inline annotations at the exact lines</>,
      <>
        <em>A hard gate: <code>min-grade</code> fails PRs below the bar</em>
      </>,
    ],
    cmd: (
      <>
        <span className="c"># .github/workflows/crossroads.yml</span>
        {"\n"}- uses: sgharlow/skillcrossroads/apps/action@v1{"\n"}
        {"  "}with:{"\n"}
        {"    "}path: ./skills{"\n"}
        {"    "}min-grade: B
      </>
    ),
    shotUrl: "github.com/sgharlow/skillcrossroads/pull/1",
    shotSrc: "/guide/j5-ci-pr-comment.png",
    shotAlt:
      "A merged pull request where the Skill Crossroads Action posted a scorecard comment: overall 100/100, per-category table, 'Clean scan — no warnings or failures', 3 checks passed",
    cap: (
      <>
        A real PR, gated and merged:{" "}
        <a href="https://github.com/sgharlow/skillcrossroads/pull/1">github.com/sgharlow/skillcrossroads/pull/1</a>
      </>
    ),
  },
];

const TOC: Array<{ id: string; title: string; when: string }> = [
  { id: "scan", title: "Scan any public repo — free, no signup", when: "30 seconds" },
  { id: "fix", title: "Read the scorecard and fix from receipts", when: "10 minutes" },
  { id: "badge", title: "Put the live badge in your README", when: "2 minutes" },
  { id: "paste", title: "Paste-to-scan when there's no repo yet", when: "1 minute" },
  { id: "ci", title: "Gate pull requests in CI", when: "one workflow file" },
];

export default function GuidePage() {
  return (
    <main className="wrap">
      <header className="nav">
        <a className="brand" href="/">
          <Signpost size={22} />
          <span>Skill Crossroads</span>
        </a>
        <nav className="rlinks">
          <a className="rlink" href="/scorecard">Sample scorecard</a>
          <a className="rlink" href="/gallery">Gallery</a>
          <a className="rlink" href="/pricing">Pricing</a>
          <a className="rlink" href="https://github.com/sgharlow/skillcrossroads">GitHub</a>
          <a className="btn-sm" href="/#scan">Scan a skill</a>
        </nav>
      </header>

      <p className="kicker">New-user guide</p>
      <h1>Five journeys from first scan to shipped badge.</h1>
      <p className="lede">
        Skill Crossroads grades Claude Code artifacts — skills, subagents, slash commands, MCP
        configs, and plugins — against an evidence-cited rubric, then points you one of three ways:{" "}
        <strong>ship, fix, or rethink</strong>. These are the five things new users actually do, in
        the order they usually do them. Every screenshot below is the real product.
      </p>
      <div className="chips">
        <span className="chip ship">Ship — grade A/B</span>
        <span className="chip fix">Fix — grade C/D</span>
        <span className="chip rethink">Rethink — grade F</span>
      </div>

      <ol className="toc">
        {TOC.map((t, i) => (
          <li key={t.id}>
            <a href={`#${t.id}`}>
              <span className="n">{i + 1}</span>
              <span className="t">{t.title}</span>
              <span className="w">{t.when}</span>
            </a>
          </li>
        ))}
      </ol>

      {JOURNEYS.map((j, i) => (
        <section className="slide" id={j.id} key={j.id}>
          <div className="eyebrow">
            <span className="jn">{i + 1}</span>
            <span className="jk">{j.kicker}</span>
          </div>
          <h2>{j.title}</h2>
          <p className="why">{j.why}</p>
          <div className="cols">
            <div className="panel">
              <h3>What you do</h3>
              <ol>{j.doSteps.map((s, k) => <li key={k}>{s}</li>)}</ol>
            </div>
            <div className="panel">
              <h3>What you get</h3>
              <ul>{j.getItems.map((s, k) => <li key={k}>{s}</li>)}</ul>
            </div>
          </div>
          {j.cmd !== undefined && <pre className="cmd">{j.cmd}</pre>}
          <figure className="shot">
            <div className="bar" aria-hidden="true">
              <span className="dot" /><span className="dot" /><span className="dot" />
              <span className="url">{j.shotUrl}</span>
            </div>
            {/* Real product screenshots, captured 2026-07-11. */}
            <img src={j.shotSrc} alt={j.shotAlt} width={1280} height={800} />
          </figure>
          {j.cap !== undefined && <p className="cap">{j.cap}</p>}
        </section>
      ))}

      <footer className="close">
        <p className="kicker">Where to go next</p>
        <h2>Everything above is free. Pro adds the private half.</h2>
        <p className="why">
          Public scans, the CLI, the badge, paste-to-scan, and the CI Action cost nothing. Pro
          ($19/mo) adds private-repo scanning and managed LLM checks — no key needed.
        </p>
        <nav className="next">
          <a href="/#scan"><span className="k">Scan a repo →</span><span className="d">skillcrossroads.com</span></a>
          <a href="/docs/checks"><span className="k">Check reference</span><span className="d">Every check: why it matters, how to fix it</span></a>
          <a href="/docs/code-handling"><span className="k">Your code &amp; privacy</span><span className="d">Scores stored, never source</span></a>
          <a href="/report"><span className="k">State of Claude Code Skills</span><span className="d">The ecosystem data report</span></a>
        </nav>
      </footer>

      <style>{`
        .wrap{max-width:900px;margin:0 auto;padding:26px 20px 60px}
        .nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:34px}
        .brand{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:17px;text-decoration:none;color:var(--fg)}
        .btn-sm{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:600;border-radius:9px;padding:8px 14px;text-decoration:none;font-size:14px}
        .rlinks{display:flex;gap:14px;align-items:center}
        .rlink{color:var(--faint);font-size:13.5px;text-decoration:none}
        .rlink:hover{color:var(--fg)}
        @media(max-width:640px){.rlink{display:none}}
        .kicker{color:var(--faint);font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-bottom:10px}
        h1{font-size:clamp(30px,5.5vw,46px);letter-spacing:-.025em;font-weight:800;line-height:1.08;text-wrap:balance;margin-bottom:14px;max-width:16ch}
        .lede{color:var(--muted);font-size:16.5px;line-height:1.6;max-width:60ch;margin-bottom:18px}
        .lede strong{color:var(--fg)}
        .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:30px}
        .chip{font-size:12.5px;font-weight:700;border-radius:999px;padding:4px 12px;color:#fff}
        .chip.ship{background:var(--ship)} .chip.fix{background:var(--fix)} .chip.rethink{background:var(--rethink)}
        .toc{list-style:none;padding:0;margin:0 0 12px;border-top:1px solid var(--line)}
        .toc li{border-bottom:1px solid var(--line)}
        .toc a{display:grid;grid-template-columns:40px 1fr auto;gap:14px;align-items:baseline;padding:12px 4px;text-decoration:none;color:var(--fg)}
        .toc a:hover .t{color:var(--accent)}
        .toc .n{font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums}
        .toc .t{font-weight:700;font-size:15.5px}
        .toc .w{color:var(--faint);font-size:13px}
        @media(max-width:620px){.toc .w{display:none}}
        .slide{padding:52px 0 46px;border-bottom:1px solid var(--line)}
        .eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:12px}
        .jn{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--accent);color:var(--accent-ink);font-weight:800;font-size:16px}
        .jk{color:var(--faint);font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}
        h2{font-size:clamp(22px,3.6vw,30px);font-weight:800;letter-spacing:-.02em;text-wrap:balance;margin-bottom:10px}
        .why{color:var(--muted);font-size:15.5px;line-height:1.6;max-width:64ch;margin-bottom:20px}
        .why a{color:var(--accent)}
        .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
        @media(max-width:680px){.cols{grid-template-columns:1fr}}
        .panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:15px 17px}
        .panel h3{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);font-weight:700;margin-bottom:10px}
        .panel ol,.panel ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:7px;font-size:14px;line-height:1.5}
        .panel li em{color:var(--muted);font-style:normal}
        .cmd{background:#0b1220;color:#dce6f5;border:1px solid var(--line);border-radius:10px;padding:13px 16px;font-size:13px;overflow-x:auto;white-space:pre;line-height:1.6;margin:0 0 20px;font-family:var(--mono)}
        .cmd .c{color:#7e8fa6}
        .cmd .g{color:#4ade80}
        .cmd .y{color:#ffc24b}
        .shot{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 10px 30px -18px rgba(11,18,32,.45)}
        .bar{display:flex;align-items:center;gap:7px;background:var(--surface-2);border-bottom:1px solid var(--line);padding:9px 14px}
        .dot{width:9px;height:9px;border-radius:50%;background:var(--line)}
        .url{margin-left:8px;font-size:12px;color:var(--faint);font-family:var(--mono)}
        .shot img{display:block;width:100%;height:auto}
        .cap{color:var(--faint);font-size:13px;margin-top:10px}
        .cap a{color:var(--accent)}
        .close{padding:52px 0 20px}
        .next{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:20px}
        .next a{display:block;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:15px 17px;text-decoration:none;color:var(--fg)}
        .next a:hover{border-color:var(--accent)}
        .next .k{display:block;font-weight:700;margin-bottom:4px}
        .next .d{display:block;color:var(--muted);font-size:13px}
        a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
        @media (prefers-reduced-motion: no-preference){ html{scroll-behavior:smooth} }
      `}</style>
    </main>
  );
}
