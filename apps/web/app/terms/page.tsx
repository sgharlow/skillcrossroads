import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/SiteNav";

/**
 * Terms of Service for the hosted site (skillcrossroads.com).
 *
 * Every sentence here must be true of the code TODAY — a false statement in a contract a paying
 * customer reads is worse than a missing one. Where a claim rests on code, the code is named in a
 * comment beside it so the next billing/scan change knows which sentence it can falsify.
 *
 * Operator identity reuses Steve's other live Terms (relay: "provided by Steve Harlow, an
 * individual — there is no company"). No governing law is named because none of his other live
 * Terms names one — that is an open decision for Steve, not something to invent here.
 *
 * NOT legal advice and NOT counsel-reviewed.
 */

// Moves with the content: test/terms-page.test.ts fails when this file's last commit is newer
// than this date, so a reader comparing versions is never told nothing changed. (Not exported:
// Next.js rejects non-standard exports from a page module.)
const UPDATED = "28 September 2026";

/** The ONE contact route for these terms — the same address /privacy already uses. */
const CONTACT_EMAIL = "sgharlow@gmail.com";
const REPO_URL = "https://github.com/sgharlow/skillcrossroads";

export const metadata: Metadata = {
  title: "Terms of Service — Skill Crossroads",
  description:
    "The terms for skillcrossroads.com: who provides it, the Pro subscription and 14-day trial, cancelling, your content and the opt-in gallery, acceptable use, and what is not promised.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="wrap">
      <SiteNav />

      <h1>Terms of Service</h1>
      <p className="lede">
        These terms cover the hosted service at skillcrossroads.com — scans, scorecards, badges,
        the gallery, and the Pro subscription. The command-line tool, the scanning engine and the
        GitHub Action are open-source software under the MIT License; that licence, not this page,
        governs them. Last updated {UPDATED}.
      </p>

      <h2>Who provides Skill Crossroads</h2>
      <ul className="facts">
        <li>
          Skill Crossroads is provided by <strong>Steve Harlow</strong>, an individual — there is
          no company. These terms are an agreement between you and him; &ldquo;we&rdquo; and
          &ldquo;us&rdquo; on this site mean him.
        </li>
        <li>
          By using the site, signing in, or starting a subscription you agree to these terms and
          to the <a href="/privacy">privacy policy</a>. If you do not agree, do not use the hosted
          service.
        </li>
      </ul>

      <h2>What the service is — and what a grade is not</h2>
      <ul className="facts">
        <li>
          Skill Crossroads grades Claude Code artifacts (skills, agents, slash commands, MCP
          configs, plugins) with automated checks and produces a scorecard, a letter grade and a
          badge. The checks are documented at <a href="/docs/checks">the check reference</a>.
        </li>
        <li>
          A grade is an automated assessment of the files as they were when scanned. It is{" "}
          <strong>not a security audit, a certification, or an endorsement</strong>, and it can be
          wrong. Do not rely on it as the only check before you ship or install something.
        </li>
        <li>
          Scanning public artifacts, scorecards, badges and the gallery are free and need no
          account.
        </li>
      </ul>

      <h2>Accounts</h2>
      <ul className="facts">
        <li>
          Signing in uses your GitHub account (GitHub OAuth). There is no separate Skill
          Crossroads password. You are responsible for your GitHub account and for what is done
          while you are signed in.
        </li>
      </ul>

      {/* Mechanism: app/api/checkout/route.ts (mode subscription, trial_period_days 14, login
          required, Stripe-hosted checkout) and app/api/stripe/webhook/route.ts (Pro only while the
          subscription is active or trialing). */}
      <h2>Pro subscription, trial and billing</h2>
      <ul className="facts">
        <li>
          Pro is a <strong>monthly subscription</strong> at the price shown on{" "}
          <a href="/pricing">the pricing page</a> when you subscribe. You must be signed in with
          GitHub to subscribe, and Pro is attached to that GitHub login.
        </li>
        <li>
          New subscriptions start with a <strong>14-day free trial</strong>. Stripe asks for a
          payment method at checkout. If you do not cancel before the trial ends, the first
          monthly charge is taken then, and the subscription{" "}
          <strong>renews automatically every month</strong>, charging the same payment method,
          until you cancel.
        </li>
        <li>
          Payments are processed by <strong>Stripe</strong> on pages Stripe hosts. We never see or
          store your card details.
        </li>
        <li>
          If a payment fails and the subscription stops being active, Pro features switch off
          until it is active again.
        </li>
      </ul>

      {/* Mechanism: app/api/billing/portal/route.ts opens the Stripe Customer Portal; the portal
          was configured by scripts/activate-stripe-portal.mjs with subscription_cancel
          mode "at_period_end", proration_behavior "none". Nothing in this codebase refunds. */}
      <h2>Cancelling and refunds</h2>
      <ul className="facts">
        <li>
          You can cancel at any time from <a href="/account">your account</a> &rarr; Manage
          billing, which opens Stripe&rsquo;s customer portal — the same place you update your card
          or download invoices. Cancelling stops future charges. Pro stays on until the end of the
          period you have already paid for (or the end of the trial), then your account returns to
          Free.
        </li>
        <li>Ending Pro deletes nothing: your account and score history stay as they are.</li>
        {/* 30-day money-back: Steve's ruling 2026-09-28, matching relay's REFUND_POLICY. Refunds
            are issued by hand in the Stripe dashboard; no code path refunds automatically. */}
        <li>
          30-day money-back guarantee: if Pro is not what you expected, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> within 30 days of a charge —
          including a renewal charge — and we will refund that charge in full. After that window,
          cancelling stops future charges but does not refund the unused part of the current
          period. Refunds are issued by hand through Stripe, not automatically.
        </li>
      </ul>

      <h2>The Team plan</h2>
      <ul className="facts">
        <li>
          Team is <strong>not self-serve</strong>, and the team features listed on the pricing page
          are not built yet. Nothing about Team is offered by these terms until it has been agreed
          with you in writing.
        </li>
      </ul>

      {/* Mechanism: /docs/code-handling (results, not source); app/api/gallery/opt-in/route.ts
          (any public repo, submitter not verified as owner); lib/pro-scan.ts (user's own token;
          managed LLM via Anthropic). */}
      <h2>Your content, scans and the gallery</h2>
      <ul className="facts">
        <li>
          <strong>You keep all rights</strong> in your repositories and artifacts. To grade them we
          read their files; you allow us to do that, to store the resulting score records, and to
          display the resulting scorecards and badges. For Pro managed checks, the artifact text
          being graded is sent to Anthropic&rsquo;s API to produce a verdict. What is stored — scores,
          not source — is set out in{" "}
          <a href="/docs/code-handling">how Skill Crossroads handles your code</a>.
        </li>
        <li>
          <strong>Public code gets public grades.</strong> Anyone can scan any public GitHub
          repository, and its scorecard and badge can be viewed by anyone. Score records are kept
          and feed trend charts and ecosystem statistics.
        </li>
        <li>
          <strong>The gallery is opt-in.</strong> A scored artifact is listed on{" "}
          <a href="/gallery">the gallery</a> only after someone submits it through the gallery form.
          The form accepts any public repository and does not verify that the person submitting it
          owns it. If your work is listed and you want it removed, email us; removals are made by
          hand.
        </li>
        <li>
          Private-repository scans (Pro) read only what your own GitHub sign-in can read. Only scan
          or paste material you are entitled to share with a third-party service.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <ul className="facts">
        <li>Do not use the service to break the law or to infringe anyone else&rsquo;s rights.</li>
        <li>
          Do not try to get around rate limits, sign-in, or the Pro entitlement check, or to reach
          anyone else&rsquo;s account or data.
        </li>
        <li>
          Do not send automated traffic heavy enough to degrade the service for others. Ordinary use
          of the scan and badge endpoints — including from CI and README badges — is fine.
        </li>
        <li>
          Do not present a badge or scorecard as showing a grade an artifact did not earn.
        </li>
      </ul>

      <h2>Availability — provided &ldquo;as is&rdquo;</h2>
      <ul className="facts">
        <li>
          The hosted service is run by one person. It is provided{" "}
          <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties</strong>{" "}
          of any kind. There is <strong>no uptime guarantee and no service-level agreement</strong>.
          Checks, grades and features change over time and may be withdrawn.
        </li>
        <li>
          If the hosted service is ever deliberately shut down, the intention is to say so on this
          site first and cancel active subscriptions so no further charges are taken — an
          intention, not a guarantee.
        </li>
      </ul>

      <h2>Limitation of liability</h2>
      <ul className="facts">
        <li>
          To the fullest extent the law allows, we are not liable for any indirect, incidental,
          special or consequential loss — including lost profits, data or goodwill — arising from
          your use of the service or reliance on a grade.
        </li>
        <li>
          Our total liability for all claims relating to the service or these terms is limited to
          the greater of the amount you paid us in the twelve months before the claim, or one
          hundred US dollars ($100).
        </li>
      </ul>

      <h2>Ending it</h2>
      <ul className="facts">
        <li>
          You can stop using the service at any time and cancel Pro from your account page.
          Deleting your account data is not self-serve yet: email us, as the{" "}
          <a href="/privacy">privacy policy</a> describes.
        </li>
        <li>
          We may suspend or end your access, or remove a gallery listing, if you break these terms
          or misuse the service.
        </li>
      </ul>

      <h2>Changes to these terms</h2>
      <ul className="facts">
        <li>
          We may update these terms. The &ldquo;last updated&rdquo; date above changes with every
          edit, and the full history of this page is public in{" "}
          <a href={REPO_URL}>the GitHub repository</a>. Continuing to use the service after a
          change means you accept it; if you do not, stop using the service and cancel any
          subscription.
        </li>
      </ul>

      <h2>Governing law</h2>
      <ul className="facts">
        <li>
          These terms do not yet name a governing law or a venue for disputes. Nothing in them
          limits any right you have under the consumer-protection law where you live.
        </li>
      </ul>

      <h2>Contact</h2>
      <ul className="facts">
        <li>
          Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — read by a person — or open
          an issue at <a href={REPO_URL}>github.com/sgharlow/skillcrossroads</a>.
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
