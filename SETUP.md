# Beacon — Account Setup Runbook

The state after the account-setup session: the code is done and the local build is green. What's
left are **account/credential steps only you can do**. Each is short; after each, I can finish the
wiring and prove it live. Secrets go in a gitignored `.env` (or the Vercel dashboard) — **never in
chat**.

## Already done (this session)

- **DB layer** — Postgres-backed entitlements / gallery / scan-history, live-proven against a local
  Postgres. Schema in `apps/web/db/schema.sql`; apply with `npm run db:migrate` (uses `DATABASE_URL`).
- **Repo pushed** — `github.com/sgharlow/beacon` (private), branch `main`.
- **Build fixed + deployed LIVE to Vercel** — the `beacon` project builds and deploys `READY` in both
  preview and production (canonical prod alias `beacon-gamma-six.vercel.app`). The build config lives
  in the **Vercel project settings** (not a `vercel.json` — that file was removed):
  - Root Directory: *(empty — repo root)*; Node 22.x; Framework: Next.js
  - Install: `npm install --include=dev`
  - Build: `npm run build --workspace @beacon/core && npm run build --workspace @beacon/web`
  - Output: `apps/web/.next`
  - Two deploy bugs were found and fixed (see below).
- **Deploy fixes** (committed):
  1. `.vercelignore` now excludes `**/*.tsbuildinfo`, and the core/cli builds use `tsc --build
     --force`. *Root cause:* the CLI shipped the `tsc --build` incremental cache but `.vercelignore`
     excludes `packages/*/dist`, so the cloud `tsc` thought core was "already built", skipped emitting
     `dist/`, and the web build failed `module_not_found: @beacon/core`.
  2. `app/pro/success/page.tsx` is `dynamic = "force-dynamic"`. *Root cause:* a purely-static leaf
     under the page-less `/pro` segment tripped Vercel's `@vercel/next` route→output mapping
     ("Unable to find lambda for route: /pro/success").
- **NOTE — not yet publicly reachable.** The project's Vercel Deployment Protection
  (`ssoProtection: all_except_custom_domains`) gates every `*.vercel.app` URL behind Vercel SSO
  (a `302 → vercel.com/sso-api`). Beacon is a public product, so **either** attach the `beacon.dev`
  custom domain (protection excludes custom domains — it goes public automatically) **or** turn
  Deployment Protection off for the project. Your call (see step 3).
- *(An empty `web` project was created by a first mis-linked attempt — delete it in the dashboard, one click.)*

## The remaining steps (in order)

### 1. Push the repo to GitHub — ✅ DONE
`github.com/sgharlow/beacon` (private, branch `main`). Optionally connect it to the Vercel project
for Git-push auto-deploys + in-dashboard build logs (currently deploys are done via `vercel deploy`
from the CLI, which works fine).

### 2. Cloud Postgres → `DATABASE_URL`
Pick one (free tiers fine): **Neon** (neon.tech) or **Supabase**. Create a project, copy the
connection string, then:
```bash
DATABASE_URL="postgres://…" npm --workspace @beacon/web run db:migrate   # creates the 3 tables
```
Set `DATABASE_URL` in Vercel (step 3). *Note: managed providers need SSL — `lib/db.ts` enables it
automatically for non-localhost hosts.*

### 3. Vercel — project deploys LIVE; env + domain + public-access remain
The `beacon` project is created and deploying `READY` (build config already set — see "Already done").
Remaining:
- **Environment variables** (Project → Settings → Environment Variables): `DATABASE_URL`,
  `GITHUB_TOKEN` (a PAT for scan rate limits), `NEXT_PUBLIC_SITE_URL=https://beacon.dev`, plus the
  Stripe / OAuth / managed-key vars below. I can set these via the Vercel API once you provide the
  values (in a gitignored file / env, never chat).
- **Public access** — pick one:
  - **Add the `beacon.dev` domain** (Project → Domains). Protection excludes custom domains, so the
    site goes public on the domain automatically. *(Recommended — you own the domain.)*
  - **Disable Deployment Protection** (Project → Settings → Deployment Protection → Vercel
    Authentication → off) to make the `*.vercel.app` URLs public.

### 4. GitHub OAuth app → `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
GitHub → Settings → Developer settings → **New OAuth App**. Homepage `https://beacon.dev`, callback
`https://beacon.dev/api/auth/github/callback`. Add both to Vercel env. (Private-repo scanning needs
the `repo` scope — the app already requests `read:user`; widen if you want private scans.)

### 5. Stripe — ✅ DONE (test) locally; production wiring remains
Proven this session: `stripe login`, created **Beacon Pro** + a **$19/mo** Price
(`price_1TrAm9Gs40KMmT4XM4rbrNPI`, 14-day trial), wired test keys into `apps/web/.env.local`, and
verified end-to-end — a real `checkout.stripe.com` session renders correctly and a
`checkout.session.completed` webhook flipped `testuser pro=true` in Postgres. (Didn't click **Start
trial** with the `4242` card — card entry is yours, by policy.)

**Production:** in the Stripe dashboard create a **live** Pro Price, add a webhook endpoint
`https://beacon.dev/api/stripe/webhook` (events `checkout.session.completed`,
`customer.subscription.deleted`), and set `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` /
`STRIPE_WEBHOOK_SECRET` in Vercel.

### 6. npm publish (the CLI + the Action's `npx beacon@latest`)
```bash
npm login
```
**Name check first:** `beacon` is almost certainly taken on npm — run `npm view beacon` / pick a name
(e.g. a scoped `@sgharlow/beacon`). Tell me the final name and I'll update `packages/cli/package.json`
+ the Action (`apps/action`) references, then we `npm publish`.

### 7. (Optional) managed LLM for Pro → `BEACON_MANAGED_ANTHROPIC_KEY`
Set an Anthropic key in Vercel env so Pro users get triggering/verification/constraint/exact-token
checks without their own key.

## Env var reference

| Var | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Vercel + local `.env.local` | Postgres backing (entitlements, gallery, scans) |
| `GITHUB_TOKEN` | Vercel | Higher GitHub rate limits for scans |
| `NEXT_PUBLIC_SITE_URL` | Vercel | Canonical URL for sitemap/robots |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | Vercel | Pro checkout + webhook |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Vercel | Sign-in with GitHub |
| `BEACON_MANAGED_ANTHROPIC_KEY` | Vercel | Managed LLM checks for Pro |

Every paid/optional feature is env-gated: unset → a clean 501 (or in-memory/deterministic fallback);
the free tier always works.
