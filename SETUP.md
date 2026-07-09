# Beacon — Account Setup Runbook

The state after the account-setup session: the code is done and the local build is green. What's
left are **account/credential steps only you can do**. Each is short; after each, I can finish the
wiring and prove it live. Secrets go in a gitignored `.env` (or the Vercel dashboard) — **never in
chat**.

## Already done (this session)

- **DB layer** — Postgres-backed entitlements / gallery / scan-history, live-proven against a local
  Postgres. Schema in `apps/web/db/schema.sql`; apply with `npm run db:migrate` (uses `DATABASE_URL`).
- **Build fixed** — `tsc --build` for the workspace packages; the web app builds from the repo root
  (`npm run build --workspace @beacon/web`). Verified locally.
- **Vercel project `beacon`** created under your account (root `vercel.json` configures the monorepo
  build). *(An empty `web` project was created by a first mis-linked attempt — delete it in the
  dashboard, one click.)*

## The remaining steps (in order)

### 1. Push the repo to GitHub
Needed for the Vercel Git integration (clean build logs + native workspaces), the GitHub Action, and
npm visibility.
```bash
gh repo create beacon --private --source=. --remote=origin --push   # gh is already authed
```

### 2. Cloud Postgres → `DATABASE_URL`
Pick one (free tiers fine): **Neon** (neon.tech) or **Supabase**. Create a project, copy the
connection string, then:
```bash
DATABASE_URL="postgres://…" npm --workspace @beacon/web run db:migrate   # creates the 3 tables
```
Set `DATABASE_URL` in Vercel (step 3). *Note: managed providers need SSL — `lib/db.ts` enables it
automatically for non-localhost hosts.*

### 3. Vercel (Git integration + env + domain)
In the Vercel dashboard → **Add New → Project → import the GitHub repo**:
- **Root Directory:** `apps/web`
- **Build/Install:** the root `vercel.json` already sets them (or set Build = `npm run build
  --workspace @beacon/web`, Output = `apps/web/.next`).
- **Environment variables:** `DATABASE_URL`, `GITHUB_TOKEN` (a PAT for scan rate limits),
  `NEXT_PUBLIC_SITE_URL=https://beacon.dev`, plus the Stripe / OAuth / managed-key vars below.
- **Domain:** add `beacon.dev` (you own it) under the project's Domains.

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
