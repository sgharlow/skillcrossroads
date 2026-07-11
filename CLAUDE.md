# Skill Crossroads — Codebase Guide (CLAUDE.md)

> **The signpost for Claude Code artifacts** — live at [skillcrossroads.com](https://skillcrossroads.com).
> Skill Crossroads audits a Claude Code artifact (Skill, subagent, slash command, MCP server, or plugin) and
> returns an evidence-cited quality scorecard with a letter grade, plus an embeddable badge.
> "Beacon" is the original internal codename — it survives in workspace package names
> (`@beacon/*`), `BEACON_*` env vars, and cookie names by design; the product, domain, npm
> package (`skillcrossroads`), and all user-facing copy are Skill Crossroads. The full product
> spec (the "Build Bible") lives in the maintainer's private docs repo — it is not committed
> here; the rubric, check catalog, and conventions below are the public source of truth.

## What this repo is (and is not)

Skill Crossroads is **open-core**: the CLI and public audits are free (that is the marketing /
badge loop); money is the hosted Pro tier (private-repo scanning, managed LLM checks, CI gating,
dashboards).

**Current scope (rubric v1.2):** the `@beacon/core` engine + the `skillcrossroads` CLI (npm),
grading FIVE artifact kinds — **skills, subagents, slash commands, `.mcp.json` configs, and plugins** (a plugin scan = the `.claude-plugin/plugin.json` manifest row PLUS its member artifacts — the roll-up batch)
(kind-aware `applicableChecks`/`applicableAsyncChecks`; `mcp` is whitelist-only so prose checks
never mis-fire on JSON). **26 deterministic checks** + 4 LLM-assisted (TRIGGER-01/VERIFY-04/
CLARITY-05/CLARITY-02, BYOK, kind-scoped) + 3 live MCP server checks (`--mcp-live`, CLI-only opt-in —
NEVER hosted: spawning configured commands server-side is RCE by design). Keyless SKILL scans
score all six categories. Surfaces: terminal, HTML, badge, Markdown, JSON (`--json[=file]`),
GitHub annotations (`--annotations`), paste-to-scan (`/paste`), hosted repo scans incl.
single-file artifacts, `.skillcrossroads.json` config/suppression (SAFETY-* unsuppressible),
ecosystem percentile (full-rubric SKILL cards only), `skillcrossroads init` (inserts the
hosted badge into a repo's README — badge URL/markdown contract centralized in
`core/badge-embed.ts`, never re-expressed), and **account self-service** (`/account`: identity +
plan + per-user scan history; `/api/billing/portal` Stripe Customer Portal for cancel/manage;
`/api/auth/logout`). Hosted app + GitHub Action (`v1`) + Stripe Pro all live and owner-dogfooded.
`scripts/state-of-skills.mjs` regenerates the data report.

**Not yet built** (roadmap — do not add speculatively): more checks from the v1 catalog,
marketplace.json grading, org/team features. Everything further is demand-gated (see ROADMAP.md).

### LLM-assisted checks (BYOK) — the async path

Deterministic checks stay **pure and sync** (`Check`, `runChecks`). LLM checks are a **separate**
`AsyncCheck` contract (`checks/async.ts`) run by `runChecksAsync(artifact, ctx)` — never fold LLM
I/O into the sync path. `ctx.model` (a model-agnostic `ModelClient`, `llm/`) gates them: no model →
deterministic-only, and the LLM category stays "not yet scored" (the honest partial-grade design).
A model error is reported via `ctx.onError` and the check is **dropped**, never allowed to tank the
grade. Rules: model-agnostic (`ModelClient` interface, Anthropic impl via raw `fetch` — no SDK dep);
**structured output only** (force a strict tool call, validate/clamp in `parseVerdict`); **cache by
content hash** (`llm/cache.ts`) so unchanged artifacts re-scan free. Model defaults to
`claude-opus-4-8`, override with `BEACON_MODEL`. TRIGGER-01 is **live-proven** (92.9% label
agreement, gate ≥80% — `npm run eval:triggering` with a key).

The visual renderers (`render/html.ts`, `render/badge.ts`) share one hex palette in
`render/theme.ts` (the "harbor marker light" scheme); the terminal renderer uses picocolors
separately. HTML output must stay **fully self-contained** — no external asset requests, all CSS
inlined — and must **escape** every dynamic value (a scanned skill is untrusted input).

## The claim ladder (honest status, always)

Never write "DONE" bare. The ladder: idea → built → wired → live-proven → dogfooded →
customer-used → revenue-proven. This repo's status: the **engine, CLI, and hosted web app are
`live-proven`** (production at skillcrossroads.com; `skillcrossroads` on npm, npx-verified;
TRIGGER-01 ran against the real Anthropic API at 92.9% label agreement). **The full money path is
`dogfooded`** (2026-07-10: real OAuth round-trip → live Stripe Pro subscription → webhook flipped
the Postgres entitlement in ~1.3s → a Pro scan ran managed-LLM with all six categories scored),
and the **Action is `live-proven`** (scanned, commented a scorecard, and gated on a real PR —
including a correct hard-fail on a bad path). Not yet: `customer-used` (no arms-length user) or
`revenue-proven` (trial, $0 collected). When you finish work, state the ladder level.

## Architecture

Everything flows through one pure pipeline in `@beacon/core`:

```
parse(skillDir) → Artifact
runChecks(artifact) → CheckResult[]
score(results)     → Scorecard   { overall, grade, categories }
renderTerminal(scorecard, artifact) → string
```

- `packages/core` — the asset. Standalone, model-agnostic library. **No I/O in the scoring
  logic** except `parse()` (which reads the skill dir) and check modules that read supporting
  files. Everything else is pure functions over data so it is trivially testable and reusable
  by the CLI, the future web app, and the future GitHub Action.
- `packages/cli` — a thin wrapper: resolve a path, call the pipeline, print. No business logic.

### Adding a check = adding one file (this is the compounding moat)

A **check** is a small module implementing the `Check` interface
(`packages/core/src/checks/types.ts`):

```ts
{ id, category, title, weight, run(artifact): CheckResult }
```

Each check emits `status` (`pass` | `warn` | `fail`), a `score` (0–100), and **evidence**
(`file`, `line`, `snippet`, and a `claimed` vs `verified` note where relevant). The evidence-
cited, file-and-line, "claimed vs verified" voice IS the brand — every check must produce
concrete receipts, never vibes. Register new checks in `packages/core/src/checks/index.ts`.

The current catalog (rubric v1.2): **deterministic** — `STRUCT-01/02/05` frontmatter/fields/refs ·
`TOKEN-01/02/03` budgets + disclosure · `TOKEN-04` recurring per-invocation cost estimate
(informational; never fails — TOKEN-01 owns the budget gate) · `CLARITY-03` no filler · `SAFETY-01..04` secrets
(incl. JSON env values)/least-privilege/auto-invoke/`!`-injection · `TRIGGER-02/03` description
length + invocation cues · `TRIGGER-05` invocation-flag consistency (skills+agents ONLY —
commands keep Triggering n/a: an explicitly-invoked command must not fill the rubric's largest
category from mere flag-absence) · `VERIFY-01` evals present (skills) · `VERIFY-03`
version/changelog/readme hygiene (skills; informational, always passes — a per-skill scan
can't see repo-root hygiene) · `AGENT-01` model validity ·
`CMD-01` argument-hint agreement · `MCP-01/02/03` config shape/pinning/TLS · `PLUGIN-01/02/03` manifest validity/component
resolution/description · `HOOK-01` hooks destructive-command sweep. **LLM-assisted
(BYOK, kind-scoped)** — `TRIGGER-01` (skills+agents) · `VERIFY-04` · `CLARITY-05` · `CLARITY-02`
internal contradictions. **Live MCP
(`--mcp-live`)** — `MCPT-01/02/03` reachability/tool descriptions/param docs. The full v1 catalog
lives in the private Build Bible; the
implemented set in `packages/core/src/checks/index.ts` is the public source of truth.

**Token counting — honesty rule.** The char-based estimate is NOT ±5% accurate (skill markdown
tokenizes denser than prose; `npm run eval:tokens` shows ~10–25% error, worst on code-heavy
skills). Never present it as exact. The exact figure comes from `count_tokens` (the tokenizer
`/context` uses) when a key is present — precomputed once in `runChecksAsync` and threaded to
TOKEN-01 via `CheckContext.accurateTokens`. TOKEN-01 labels the number `exact` vs `rough est`.

### Rubric & scoring

Six weighted categories (weights defined in `packages/core/src/types.ts`): correctness 20%, triggering 22%, clarity 18%,
token 15%, safety 15%, verifiability 10%. The rubric is **versioned** (`RUBRIC_VERSION`) — a
rubric bump is a content/announcement event, so never change weights silently.

Under **rubric v1.2, keyless SKILL scans score all six categories** (Triggering via
TRIGGER-02/03/05, Verifiability via VERIFY-01/03). COMMANDS keep Triggering **n/a for the kind**
(TRIGGER-05 is skills+subagents only — a command with no triggering affordances must not score
the category from flag-absence). Overall is computed over **evaluated
categories only, with weights renormalized**. **Partial is kind-aware** (Sprint 7):
`applicableCategories(kind)` in the check
registry is the one authoritative answer to "what CAN score for this kind" (deterministic + LLM +
live-MCPT for mcp), and a grade is `partial` only when an APPLICABLE category went unscored
(keyless LLM checks, a static-only mcp scan, a suppression hole). Categories no check can ever
score for the kind (e.g. Token cost for a `.mcp.json` config) are `applicable: false`,
render as "n/a for this artifact kind", and never mark the grade partial — so a keyed command
scan or a full `--mcp-live` scan carries no asterisk. This is deliberate honesty, not a bug —
do not fake scores for categories without checks.

**Check docs are part of the check** (Sprint 7): `docs: { why, fix, good?, bad? }` is a REQUIRED
field on `Check`/`AsyncCheck` — a check without fix guidance cannot compile. `allCheckDocs()`
feeds the hosted `/docs/checks` reference pages (statically generated, sitemapped), and every
surface links findings to their page via `checkDocsUrl` (`badge-embed.ts`, alongside the badge
URL contract).

### GitHub scanning (`github.ts`, `scanGitHubRepo`)

Scanning a repo does **not** clone and does **not** change the local pipeline. It fetches the git
tree, then **materializes** each skill into a temp dir and runs the *normal* `auditAsync` — so
every check works unchanged. To respect GitHub rate limits, `materializeSkill` downloads real
content only for `SKILL.md` (always) and a capped set of text files (for SAFETY-01); every other
blob becomes an **empty placeholder** so the file list stays accurate (STRUCT-05 needs names, not
content). A per-skill failure is recorded in `RepoScanResult.errors` and skipped — a batch always
returns partial results. All GitHub functions take an injectable `fetchImpl` so they're testable
without network. Reports pin the git **tree sha** for reproducibility.

## Hosted web app (`apps/web`, Next.js)

The web app (Sprint 7) reuses `@beacon/core` — it does NOT reimplement scoring. Route handlers
(`app/s/[...slug]`, `app/api/badge`, `app/api/scan`) run on the **Node runtime** (`export const
runtime = "nodejs"`) because core uses `fs`/temp dirs; scans go through `scanGitHubRepo` and render
via the same `renderHtml`/`renderBadge`. Badge/scorecard responses use `s-maxage` for
always-fresh-with-short-TTL. GitHub OAuth (`app/api/auth/github`) is env-gated on
`GITHUB_CLIENT_ID`/`SECRET` (returns 501 unset) and configured in production. Deployed on Vercel
with `skillcrossroads.com` attached (apex canonical; `www` 308-redirects to apex).

**Gotcha:** the web app uses `moduleResolution: "bundler"`, so relative imports inside `apps/web`
take **no `.js` extension** (`./scan`, not `./scan.js`) — the opposite of core's NodeNext. Imports
from `@beacon/core` are fine (package resolution).

### Monetization (Sprint 8, open-core)

Stripe subscription checkout (`/api/checkout`, `mode:"subscription"`, **never** pass
`payment_method_types`) + webhook (`/api/stripe/webhook`, signature-verified) flip a **Pro
entitlement** (`lib/entitlements.ts` — Postgres-backed when `DATABASE_URL` is set, as in
production; in-memory fallback for keyless local dev). Pro unlocks
**private-repo scanning** (the user's OAuth token) and **managed LLM** (server
`BEACON_MANAGED_ANTHROPIC_KEY`, so TRIGGER-01 + exact tokens run without the user's key) via
`resolveScanOptions`. **The free tier must never depend on any of this** — every paid path is env-
gated and returns a clean 501 unconfigured; public deterministic scans always work. Stripe (live),
the DB, and the managed key are configured in production; the money path is **owner-`dogfooded`** —
a live checkout webhook has flipped the Postgres entitlement (verified: one subscription row with a
Stripe customer id) — but **no arms-length customer purchase has happened yet (not customer-proven)**.
Cancellation/management is self-serve via the Stripe Customer Portal (`/api/billing/portal`, opened
from `/account`); sign-out is `/api/auth/logout`.

### Public gallery (Sprint 10)

`/gallery` is a server-rendered, SEO-indexed (`app/sitemap.ts` + `app/robots.ts`) leaderboard of
opted-in skills, with sort (score/recent/name) + filter (min-grade/search). Opt-in via
`/api/gallery/opt-in` (scans then lists). Backed by `lib/gallery.ts` (in-memory, **Postgres in
production**). **Known limitation, by design:** the in-memory store is **not shared across Next
route/page bundles or serverless instances**, so an opt-in POST isn't visible to the gallery page
until the DB backs it. A static `SEED` gives every instance the same starter leaderboard so the UI
renders consistently meanwhile — exactly why the gallery (and entitlements) need the shared DB
before real use.

### Score history & trend dashboard (Sprint 11)

Every scorecard scan is recorded (`lib/record.ts`, fire-and-forget) into the `scans` table via the
`scanHistory` store (`lib/scans.ts`: `record` / `history` / `recent` / `mine` / `stats`; memory +
Postgres). A scan run **while signed in** is attributed to that user via a nullable `scans.login`
column (anonymous scans stay anonymous, `login = null`); `mine(login)` powers the per-user "your
recent scans" list on `/account`. Recording happens on the `/s/[...slug]` and gallery-opt-in paths.
`/trends/[...slug]` renders a **self-contained inline SVG** trend chart (`lib/chart.ts` — no chart
library, grade-colored dots) of a skill's overall score over time; `/dashboard` is the metrics view
(totals, per-skill latest-grade distribution, recent scans). Built and live-proven against the real
Postgres.

## Conventions

- **TypeScript, ESM (`"type": "module"`), NodeNext.** `strict` + `noUncheckedIndexedAccess` on.
- **npm workspaces.** Root scripts: `npm run build`, `npm test`, `npm run typecheck`.
- **Tests: vitest.** Every check has snapshot/unit tests against fixtures in
  `packages/core/test/fixtures/`. A fixture is a tiny skill dir designed to trip (or pass) one
  check. Run `npm test` before every commit. Determinism is required — no check may call the
  network or an LLM in v0.1.
- **No secrets, ever**, in code or fixtures — SAFETY-01 would (correctly) flag them, and this
  repo is meant to go public. Use obviously-fake placeholder patterns in security fixtures.
- **Commits:** do NOT add a `Co-Authored-By: Claude` / "Generated with Claude" trailer (public
  repo; portfolio policy). The private strategy docs (Build Bible, v2 considerations) are
  gitignored here and tracked in the maintainer's private docs repo — never commit them.

## CI / GitHub Action (Sprint 9)

The CLI is CI-native: a local path may be a **single skill or a folder of skills**
(`scanLocalDir` finds every `SKILL.md`); `--markdown` emits a PR-comment-ready report
(`renderMarkdown`, core); `--min-grade <G>` sets `process.exitCode = 1` when any skill grades below
`<G>` (`meetsMinGrade` / `gradeRank` in `score.ts`) — the CI gate. `apps/action` is a **composite**
GitHub Action (`action.yml` + `comment.mjs`, a dependency-free PR-comment poster that updates one
marker comment in place). The action runs `npx skillcrossroads@latest` (published) and is tagged
`v1`; **live-proven 2026-07-10** — it scanned, posted the scorecard comment, and enforced the
gate on a real PR (this repo's own `.github/workflows/crossroads.yml` now dogfoods it on every PR).

## Running locally

```bash
npm install
npm run build          # compile core, then cli, to dist/
node packages/cli/dist/cli.js ./path-to-a-skill
# or, from a global link:  beacon ./path-to-a-skill
npm test               # vitest
```
