import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Privacy policy — Skill Crossroads",
  description:
    "What Skill Crossroads collects (account identity, score history, billing status), what it never sees (passwords, card numbers, your source), and how to remove your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="wrap">
      <SiteNav />

      <h1>Privacy policy</h1>
      <p className="lede">
        Skill Crossroads stores as little about you as it can get away with: an account identity,
        score records, and a billing status. This page lists all of it. For exactly how scanned
        code is handled, see{" "}
        <a href="/docs/code-handling">How Skill Crossroads handles your code</a> — this page covers
        the person, that page covers the code. Effective 2026-07-18.
      </p>

      <h2>What we collect</h2>
      <ul className="facts">
        <li>
          <strong>Account (optional).</strong> Signing in uses GitHub OAuth: we receive your GitHub
          login, numeric id, and avatar URL. We never see your GitHub password. Your OAuth token
          lives in an HttpOnly cookie in your browser and is never written to our database.
        </li>
        <li>
          <strong>Scan history.</strong> Each scan stores a score record (repo/path, grade,
          per-category scores, rubric version, timestamp). Anonymous scans stay anonymous; scans
          made while signed in carry your GitHub login so <code>/account</code> can show you your
          own history.
        </li>
        <li>
          <strong>Billing (Pro).</strong> Payments are processed by Stripe. We never see or store
          card numbers — we store your Stripe customer and subscription identifiers and whether the
          Pro entitlement is active. Manage or cancel any time from <code>/account</code> via the
          Stripe Customer Portal.
        </li>
        <li>
          <strong>Cookies.</strong> A session cookie when you sign in, and a short-lived
          first-touch cookie (<code>sc_ref</code>, 30 minutes) recording which link brought you
          here so we can tell which launch channel worked. No third-party advertising or tracking
          cookies.
        </li>
        <li>
          <strong>Server logs.</strong> Standard request logs from our hosting provider (Vercel),
          used for operations and abuse prevention.
        </li>
      </ul>

      <h2>Who else touches data</h2>
      <ul className="facts">
        <li>
          <strong>GitHub</strong> — OAuth sign-in and fetching repos you ask us to scan.{" "}
          <strong>Stripe</strong> — payments. <strong>Vercel</strong> — hosting and logs.{" "}
          <strong>Neon (Postgres)</strong> — where score records live.{" "}
          <strong>Anthropic</strong> — on Pro managed-LLM scans, the artifact text being graded is
          sent to the Anthropic API to produce a verdict (details on the code-handling page).
        </li>
        <li>We do not sell or share your data for advertising. There is no ad tech here.</li>
      </ul>

      <h2>Removal and contact</h2>
      <ul className="facts">
        <li>
          To remove your account data (login-attributed scan history, entitlement record), email{" "}
          <a href="mailto:sgharlow@gmail.com">sgharlow@gmail.com</a> from the address on your
          account or open an issue at{" "}
          <a href="https://github.com/sgharlow/skillcrossroads">github.com/sgharlow/skillcrossroads</a>.
          Anonymous score records contain nothing that identifies you.
        </li>
        <li>
          If this page and the code ever disagree, that is a bug — the storage layer is open
          source; please open an issue.
        </li>
      </ul>

      <SiteFooter />

      <style>{`
        .wrap{max-width:820px;margin:0 auto;padding:26px 20px 60px}
        h1{font-size:clamp(28px,5vw,40px);letter-spacing:-.02em;font-weight:800;margin-bottom:10px}
        .lede{color:var(--muted);font-size:15.5px;line-height:1.6;margin-bottom:28px;max-width:640px}
        h2{font-size:19px;font-weight:700;margin:30px 0 10px}
        .facts{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
        .facts li{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:14.5px;line-height:1.55;color:var(--fg)}
        .facts code{font-size:13px}
      `}</style>
    </main>
  );
}
