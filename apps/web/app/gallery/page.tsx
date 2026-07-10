import type { Metadata } from "next";
import { gradeHex } from "@beacon/core";
import { gallery, type GallerySort } from "@/lib/gallery";
import OptInForm from "./opt-in-form";

export const metadata: Metadata = {
  title: "Gallery — top-scored Claude Code skills",
  description:
    "A leaderboard of publicly graded Claude Code skills, ranked by Skill Crossroads' evidence-cited quality score.",
  alternates: { canonical: "/gallery" },
};

export const dynamic = "force-dynamic";

const SORTS: { key: GallerySort; label: string }[] = [
  { key: "score", label: "Top score" },
  { key: "recent", label: "Recently added" },
  { key: "name", label: "Name" },
];
const GRADES = ["", "A", "B", "C"];

function qs(base: Record<string, string | undefined>, over: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // Validate query params (untrusted): fall back to defaults rather than passing junk into the store.
  const sort: GallerySort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as GallerySort) : "score";
  const minGrade = typeof sp.grade === "string" && /^[ABCDF]$/.test(sp.grade) ? sp.grade : "";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";

  const entries = await gallery.list({ sort, minGrade: minGrade || undefined, q: q || undefined });
  const total = await gallery.count();
  const base = { sort, grade: minGrade, q };

  return (
    <main className="wrap">
      <header className="nav">
        <a className="brand" href="/">
          <span className="lamp" aria-hidden />
          Skill Crossroads
        </a>
        <nav className="rlinks">
          <a className="plink" href="/#scan">Scan a skill</a>
          <a className="plink" href="/pricing">Pricing</a>
          <a className="plink" href="/account">Account</a>
        </nav>
      </header>

      <section className="head">
        <h1>Gallery</h1>
        <p>Publicly graded Claude Code skills, ranked by Skill Crossroads&apos; evidence-cited quality score.</p>
        <div className="optwrap">
          <OptInForm />
        </div>
      </section>

      <section className="controls">
        <div className="tabs">
          {SORTS.map((s) => (
            <a key={s.key} className={s.key === sort ? "tab on" : "tab"} href={`/gallery${qs(base, { sort: s.key })}`}>
              {s.label}
            </a>
          ))}
        </div>
        <div className="grades">
          {GRADES.map((g) => (
            <a key={g || "all"} className={g === minGrade ? "chip on" : "chip"} href={`/gallery${qs(base, { grade: g })}`}>
              {g ? `${g}+` : "All"}
            </a>
          ))}
        </div>
        <form className="search" action="/gallery" method="get">
          <input type="hidden" name="sort" value={sort} />
          {minGrade && <input type="hidden" name="grade" value={minGrade} />}
          <input name="q" defaultValue={q} placeholder="Search name or repo…" aria-label="Search" />
        </form>
      </section>

      {entries.length === 0 ? (
        <p className="empty">
          {total === 0 ? "No skills yet — add the first one above." : "No skills match this filter."}
        </p>
      ) : (
        <ol className="list">
          {entries.map((e, i) => (
            <li key={e.id}>
              <a className="row" href={`/s/${e.id}`}>
                <span className="rank">{i + 1}</span>
                <span className="g" style={{ color: gradeHex(e.grade), borderColor: gradeHex(e.grade) }}>
                  {e.grade}
                </span>
                <span className="sc">{e.overall}</span>
                <span className="nm">{e.name}</span>
                <span className="repo">
                  {e.owner}/{e.repo}
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}

      <footer className="foot">{total} skills listed · anyone can add a public skill</footer>

      <style>{`
        .wrap{max-width:820px;margin:0 auto;padding:26px 20px 60px}
        .nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:15px;text-decoration:none}
        .lamp{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 50% 40%,var(--beam),#b9791f);box-shadow:0 0 14px #ffc24b99}
        .plink{color:var(--fog);font-size:13.5px;text-decoration:none}
        .plink:hover{color:var(--foam)}
        .rlinks{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
        .head{padding:34px 0 18px}
        .head h1{font-size:clamp(28px,5vw,42px);font-weight:800;letter-spacing:-.02em}
        .head p{color:var(--fog);margin:6px 0 18px;max-width:560px}
        .optwrap{max-width:520px}
        .controls{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:14px 0 18px}
        .tabs,.grades{display:flex;gap:6px}
        .tab,.chip{font-size:13px;color:var(--fog);text-decoration:none;border:1px solid var(--ink3);border-radius:8px;padding:6px 12px}
        .tab.on,.chip.on{color:#0b1220;background:var(--beam);border-color:var(--beam);font-weight:700}
        .search{margin-left:auto}
        .search input{background:var(--ink2);border:1px solid var(--ink3);color:var(--foam);border-radius:8px;padding:8px 12px;font-size:13.5px}
        .search input:focus{outline:none;border-color:var(--beam)}
        .list{list-style:none;display:flex;flex-direction:column;gap:8px}
        .row{display:grid;grid-template-columns:34px 46px 46px 1fr auto;gap:12px;align-items:center;text-decoration:none;color:inherit;
          background:var(--ink2);border:1px solid var(--ink3);border-radius:10px;padding:11px 14px}
        .row:hover{border-color:#ffc24b66}
        .rank{color:var(--fog);font-variant-numeric:tabular-nums;text-align:center;font-weight:700}
        .g{font-weight:700;text-align:center;border:1px solid;border-radius:16px;padding:2px 0;font-size:13px}
        .sc{font-weight:700;font-variant-numeric:tabular-nums;text-align:right}
        .nm{font-weight:600}
        .repo{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:var(--fog)}
        .empty{color:var(--fog);padding:30px 0;text-align:center}
        .foot{text-align:center;color:var(--fog);font-size:12px;margin-top:22px}
        @media(max-width:560px){.row{grid-template-columns:28px 42px 1fr}.sc,.repo{display:none}.search{margin-left:0;flex-basis:100%}}
      `}</style>
    </main>
  );
}
