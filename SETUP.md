# Skill Crossroads — Production Setup (ops reference)

> **Status: all setup steps COMPLETE (2026-07-09).** The app is live at
> [skillcrossroads.com](https://skillcrossroads.com). This file is the record of what is
> configured where, plus the gotchas that bit us — kept for rotation, rebuilds, and self-hosters.

## What is configured

- **Hosting** — Vercel project `beacon` (the internal codename survives in infra names).
  Build config lives in the **Vercel project settings** (no `vercel.json`):
  - Root Directory: *(empty — repo root)*; Node 22.x; Framework: Next.js
  - Install: `npm install --include=dev`
  - Build: `npm run build --workspace @beacon/core && npm run build --workspace @beacon/web`
  - Output: `apps/web/.next`
- **Domain** — `skillcrossroads.com` is canonical (apex serves; `www` 308-redirects to apex;
  the legacy `beacon-gamma-six.vercel.app` alias still resolves). `NEXT_PUBLIC_SITE_URL` is set
  to `https://skillcrossroads.com` so sitemap/robots/badge-embed URLs are correct.
- **Repo** — `github.com/sgharlow/skillcrossroads`, **public**, branch `main`, Action tag `v1`.
  Deploys are CLI-driven (`vercel deploy --prod`); the Vercel↔GitHub link exists (by repo id).
- **Database** — managed Postgres (transaction pooler); `DATABASE_URL` set in Vercel. Schema in
  `apps/web/db/schema.sql`; apply with `npm run db:migrate`. Backs entitlements, gallery, and
  scan history (in-memory fallbacks engage only when unset, e.g. keyless local dev).
- **GitHub OAuth** — OAuth app configured with homepage `https://skillcrossroads.com` and
  callback `https://skillcrossroads.com/api/auth/github/callback`; `GITHUB_CLIENT_ID`/`SECRET`
  in Vercel. (Private-repo scanning needs the `repo` scope; the app requests `read:user`.)
- **Stripe (live)** — live Pro price + webhook endpoint `https://skillcrossroads.com/api/stripe/webhook`
  (events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`);
  `STRIPE_SECRET_KEY` (restricted key), `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` in Vercel.
  Checkout is live-verified and the webhook **has fired for a live (owner) subscription** — the
  entitlement flipped in Postgres (one subscription row with a Stripe customer id). **No arms-length
  customer purchase yet** (claim ladder: `dogfooded`, not customer-proven). Cancel/manage is
  self-serve via the Stripe Customer Portal (`/api/billing/portal`, linked from `/account`); it
  requires a one-time portal activation on the live account (`apps/web/scripts/activate-stripe-portal.mjs`).
- **Managed LLM (Pro)** — `BEACON_MANAGED_ANTHROPIC_KEY` set; only used for signed-in Pro users
  (`BEACON_SESSION_SECRET` is set, which the fail-closed guard requires before any Pro grant).
- **npm** — the CLI is published as [`skillcrossroads`](https://www.npmjs.com/package/skillcrossroads)
  (public, self-bundled, zero runtime deps; README ships with the package).

## Env var reference

| Var | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Vercel + local `.env.local` | Postgres backing (entitlements, gallery, scans) |
| `GITHUB_TOKEN` | Vercel | Higher GitHub rate limits for scans |
| `NEXT_PUBLIC_SITE_URL` | Vercel | Canonical URL for sitemap/robots/badge embeds |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | Vercel | Pro checkout + webhook |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Vercel | Sign-in with GitHub |
| `BEACON_SESSION_SECRET` | Vercel | **Required for Pro.** HMAC-signs the identity cookie so Pro entitlement (and managed-LLM spend) can't be forged. |
| `BEACON_MANAGED_ANTHROPIC_KEY` | Vercel | Managed LLM checks for Pro users |

Every paid/optional feature is env-gated: unset → a clean 501 (or in-memory/deterministic
fallback); the free tier always works. **Local `.env.local` must hold TEST keys only** — live
keys belong exclusively in Vercel (Next's env loader takes the *last* duplicate, so a stray
appended live key silently wins).

## Gotchas (hard-won — keep)

1. **Vercel monorepo `tsbuildinfo` trap** — `.vercelignore` excludes `packages/*/dist` but the
   `tsc --build` incremental cache made cloud builds skip emit → `module_not_found: @beacon/core`.
   Fix: `.vercelignore` excludes `**/*.tsbuildinfo` and builds use `tsc --build --force`.
2. **`/pro/success` lambda mapping** — a purely-static leaf under the page-less `/pro` segment
   trips `@vercel/next` ("Unable to find lambda for route"); the page is `dynamic = "force-dynamic"`.
3. **npm workspace publish ignores `publishConfig.access`** — always publish with
   `npm publish -w skillcrossroads --access public`, or the release goes out restricted.
4. **Version bumps**: `npm version patch -w skillcrossroads` then publish per (3). The publish
   bundle (`prepublishOnly` → esbuild) inlines `@beacon/core`, so the package stays standalone.
5. **`npm audit` PostCSS advisory (GHSA-qx2v-qp2m-jg93) — accepted, not a real vuln.** `next`
   pins `postcss@8.4.31` (below the advisory's `<8.5.10` range) as a nested dep; `@vercel/analytics`'
   peer range on `next` makes audit surface it. It is **build-time only** (postcss stringify during
   `next build`) and this app never processes untrusted CSS, so it is not exploitable. An
   `overrides` pin does **not** take (npm won't override Next's exact nested pin); the npm-suggested
   `next@9` "fix" is a nonsensical downgrade. It clears when Next bumps its bundled postcss upstream
   — do not chase it or destabilize the tree over it.
