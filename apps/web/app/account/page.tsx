import type { Metadata } from "next";
import { cookies } from "next/headers";
import { gradeHex } from "@beacon/core";
import { readSessionFromCookieHeader } from "@/lib/session";
import { entitlements } from "@/lib/entitlements";
import { scanHistory } from "@/lib/scans";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

export default async function Account() {
  const store = await cookies();
  const header = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const session = readSessionFromCookieHeader(header);
  const login = session.login;
  const [pro, myScans] = login
    ? await Promise.all([entitlements.isPro(login), scanHistory.mine(login, 15)])
    : [false, []];

  return (
    <main className="wrap">
      <header className="nav">
        <a className="brand" href="/">
          <span className="lamp" aria-hidden />
          Skill Crossroads
        </a>
        <a className="link" href="/gallery">
          Gallery →
        </a>
      </header>

      <h1>Your account</h1>

      {!login ? (
        <section className="panel signin">
          <p className="muted">You&rsquo;re not signed in.</p>
          <a className="cta" href="/api/auth/github">
            Sign in with GitHub
          </a>
          <p className="muted small">
            Signing in lets you subscribe to Pro, scan private repos, and manage your billing here.
          </p>
        </section>
      ) : (
        <>
          <section className="panel who">
            {/* Public GitHub avatar — no token needed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="avatar"
              src={`https://github.com/${encodeURIComponent(login)}.png?size=96`}
              alt=""
              width={48}
              height={48}
            />
            <div className="who-id">
              <div className="handle">@{login}</div>
              <div className="muted small">Signed in with GitHub</div>
            </div>
            <form method="post" action="/api/auth/logout" className="who-out">
              <button className="ghost" type="submit">
                Sign out
              </button>
            </form>
          </section>

          <section className="panel plan">
            <div className="row">
              <div>
                <div className="label">Plan</div>
                <div className={`chip ${pro ? "pro" : "free"}`}>{pro ? "Pro — $19/mo" : "Free"}</div>
              </div>
              {pro ? (
                <form method="post" action="/api/billing/portal">
                  <button className="cta" type="submit">
                    Manage billing / cancel →
                  </button>
                </form>
              ) : (
                <a className="cta" href="/pricing">
                  Upgrade to Pro →
                </a>
              )}
            </div>
            <p className="muted small">
              {pro
                ? "Opens the Stripe customer portal — cancel, resume, update your payment method, or download invoices. We never see your card details."
                : "Pro adds private-repo scanning, managed LLM checks (no API key needed), hosted badges, and score history."}
            </p>
          </section>

          <section className="panel">
            <h2>Your recent scans</h2>
            {myScans.length === 0 ? (
              <p className="muted small">
                Nothing yet. Scans you run while signed in show up here.{" "}
                <a className="inline" href="/#scan">
                  Scan a repo →
                </a>
              </p>
            ) : (
              <ul className="scans">
                {myScans.map((r) => (
                  <li key={r.slug}>
                    <a href={`/s/${r.slug}`}>
                      <span className="g" style={{ color: gradeHex(r.grade) }}>
                        {r.grade}
                      </span>
                      <span className="sc">{r.overall}</span>
                      <span className="nm">{r.name}</span>
                      <span className="sl">{r.slug}</span>
                      <span className="dt">{r.scannedAt.slice(0, 10)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <style>{`
        .wrap{max-width:640px;margin:0 auto;padding:26px 20px 60px}
        .nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:15px;text-decoration:none}
        .lamp{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 50% 40%,var(--beam),#b9791f);box-shadow:0 0 14px #ffc24b99}
        .link{color:var(--aqua);font-size:13.5px;text-decoration:none}
        h1{font-size:clamp(26px,5vw,38px);font-weight:800;margin:24px 0 18px}
        .panel{background:var(--ink2);border:1px solid var(--ink3);border-radius:14px;padding:20px;margin-bottom:16px}
        .panel h2{font-size:13px;color:var(--fog);text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px}
        .muted{color:var(--fog)}
        .small{font-size:13px}
        .inline{color:var(--aqua);text-decoration:none}
        .scans{list-style:none;display:flex;flex-direction:column;gap:6px}
        .scans a{display:grid;grid-template-columns:34px 40px 1fr auto;gap:10px;align-items:center;text-decoration:none;color:inherit;padding:7px 6px;border-bottom:1px solid var(--ink3)}
        .scans a:hover{background:#ffffff08}
        .scans .g{font-weight:700;text-align:center}
        .scans .sc{font-weight:700;font-variant-numeric:tabular-nums}
        .scans .nm{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .scans .sl{grid-column:3;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:var(--fog);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .scans .dt{font-size:11px;color:var(--fog);font-family:ui-monospace,Menlo,Consolas,monospace}
        @media(max-width:560px){.scans .sl{display:none}}
        .cta{display:inline-block;background:var(--beam);color:#0b1220;font-weight:700;border-radius:10px;padding:11px 18px;text-decoration:none;border:none;cursor:pointer;font-size:14px}
        .cta:hover{filter:brightness(1.08)}
        .ghost{background:transparent;color:var(--fog);border:1px solid var(--ink3);border-radius:10px;padding:9px 14px;cursor:pointer;font-size:13.5px}
        .ghost:hover{color:var(--foam);border-color:var(--fog)}
        .signin{display:flex;flex-direction:column;align-items:flex-start;gap:14px}
        .who{display:flex;align-items:center;gap:14px}
        .avatar{border-radius:50%;background:var(--ink3)}
        .who-id{flex:1}
        .handle{font-weight:700;font-size:16px}
        .who-out{margin-left:auto}
        .row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:10px}
        .label{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--fog);margin-bottom:6px}
        .chip{display:inline-block;font-weight:700;border-radius:999px;padding:4px 12px;font-size:13px}
        .chip.pro{background:#173a24;color:#4ec87e;border:1px solid #245b39}
        .chip.free{background:var(--ink3);color:var(--foam)}
      `}</style>
    </main>
  );
}
