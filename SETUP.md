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
- **Publicly reachable ✅** — Vercel Deployment Protection was **disabled**, so the site is live and
  public at `https://beacon-gamma-six.vercel.app` (verified `200` on `/`, `/gallery`, `/s/...`).
  Attach `beacon.dev` when ready for the canonical URL (step 3).
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

### 3. Vercel — project deploys LIVE + PUBLIC; env + domain remain
The `beacon` project deploys `READY` and Deployment Protection is off (public). Remaining:
- **`NEXT_PUBLIC_SITE_URL`** — **IMPORTANT for the SEO/badge loop.** Unset, the sitemap, robots.txt,
  and the hosted badge-embed snippet default to `https://beacon.dev`, which isn't attached yet — so
  every emitted badge/scorecard URL is a dead link and the sitemap points at a dead domain. Set it in
  Vercel (Project → Settings → Environment Variables, Production+Preview) to the **currently live**
  host `https://beacon-gamma-six.vercel.app` now, then switch to `https://beacon.dev` when the domain
  is attached. *(I could not set this via the API — the CLI token lacks env-write scope; one field in
  the dashboard.)*
- **Other env vars**: `DATABASE_URL`, `GITHUB_TOKEN` (PAT for scan rate limits), `BEACON_SESSION_SECRET`
  (required before enabling Pro — see step 7), plus the Stripe / OAuth / managed-key vars below.
- **Domain**: add `beacon.dev` (Project → Domains) for the canonical URL, then update `NEXT_PUBLIC_SITE_URL`.

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

### 6. npm publish — name chosen: `@sgharlow/beacon`
`beacon` (unscoped) is taken on npm (someone else's v0.4.9), so the CLI package is renamed to
**`@sgharlow/beacon`** (the installed command is still `beacon` via `bin`). Already updated:
`packages/cli/package.json` (name + `publishConfig.access: public`), `apps/action/action.yml`
(`npx --yes @sgharlow/beacon@latest`), and the `npx` examples in the READMEs / CLAUDE.md.

**✅ PUBLISHED + LIVE (2026-07-09).** `@sgharlow/beacon@0.1.0` is on npm, **public**, verified end-to-end:
`npx @sgharlow/beacon@latest` runs standalone from a clean dir (core is bundled in via
`prepublishOnly` → esbuild; zero runtime deps). The Action, the landing-page command, and the README
`npx` instructions all work.

**⚠️ For future version bumps — always pass `--access public`:**
```bash
npm version patch -w @sgharlow/beacon      # bump
npm publish -w @sgharlow/beacon --access public
```
The `-w` workspace flag does NOT honor the package's `publishConfig.access`, so the first publish
went out **restricted** and had to be flipped with `npm access set status=public @sgharlow/beacon`.
Passing `--access public` explicitly avoids that.

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
| `BEACON_SESSION_SECRET` | Vercel | **Required for Pro.** HMAC-signs the identity cookie so Pro entitlement (and managed-LLM spend) can't be forged. Set any long random string. |
| `BEACON_MANAGED_ANTHROPIC_KEY` | Vercel | Managed LLM checks for Pro |

Every paid/optional feature is env-gated: unset → a clean 501 (or in-memory/deterministic fallback);
the free tier always works.
