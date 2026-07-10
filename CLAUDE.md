# Beacon — Codebase Guide (CLAUDE.md)

> **Lighthouse for Claude Code artifacts.** Beacon audits a Claude Code artifact (Skill,
> subagent, MCP server, or plugin) and returns an evidence-cited quality scorecard with a
> letter grade, plus an embeddable badge. The full product spec lives in
> [`Skill-Crossroads-Build-Bible.md`](./Skill-Crossroads-Build-Bible.md) — read it before making product decisions.

## What this repo is (and is not)

Beacon is **open-core**: the CLI and public audits are free (that is the marketing / badge
loop); money is the hosted tier (private-repo scanning, CI gating, dashboards — not built yet).
This repo currently implements **Sprint 1 / v0.1** only.

**v0.1 scope (what exists now):** the `@beacon/core` engine + the `beacon` CLI, running
**deterministic** checks on a **local Skill** directory **or any public GitHub repo by URL**
(`scanGitHubRepo`, batch), plus **one LLM-assisted check** (TRIGGER-01, BYOK — off unless
`ANTHROPIC_API_KEY` is set). Three output surfaces: a terminal scorecard, a **self-contained HTML
report** (`renderHtml`), and an **embeddable SVG badge** (`renderBadge`) — all with an overall
0–100 score and letter grade. `scripts/state-of-skills.mjs` batch-scans repos into a reproducible
"State of Claude Code Skills" markdown report (the data-report growth loop).

**Explicitly NOT in v0.1** (later sprints, each a shippable win — do not add speculatively):
more LLM-assisted checks, hosted backend / always-fresh badge endpoint, auth, billing,
agents/MCP/plugin scoring, GitHub Action / CI, the public gallery.

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

Never write "DONE" bare. This repo's status: **v0.1 is `built` (code + tests green)**; the
**TRIGGER-01 LLM check is `live-proven`** (ran against the real Anthropic API, 92.9% label
agreement). The product as a whole is NOT `dogfooded` end-to-end (no public users, not on npm).
When you finish work, state the ladder level. See the Build Bible §"claim ladder".

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

The v0.1 catalog: **deterministic** — `STRUCT-01` valid YAML frontmatter · `STRUCT-02` recommended
fields present · `STRUCT-05` supporting-file references resolve · `TOKEN-01` body under line/token
budget · `TOKEN-02` progressive disclosure · `TOKEN-03` description budget footprint · `CLARITY-03`
no ASCII-art/persona filler · `SAFETY-01` no hardcoded secrets · `SAFETY-02` allowed-tools
least-privilege · `SAFETY-03` no destructive auto-invocation · `SAFETY-04` no shell-injection in
`!` blocks. **LLM-assisted (BYOK)** — `TRIGGER-01` description triggers reliably · `VERIFY-04`
verification step present · `CLARITY-05` constraints & failure modes stated. (With a key, all six
rubric categories score.) Full ~24-check catalog is Appendix C of the Build Bible.

**Token counting — honesty rule.** The char-based estimate is NOT ±5% accurate (skill markdown
tokenizes denser than prose; `npm run eval:tokens` shows ~10–25% error, worst on code-heavy
skills). Never present it as exact. The exact figure comes from `count_tokens` (the tokenizer
`/context` uses) when a key is present — precomputed once in `runChecksAsync` and threaded to
TOKEN-01 via `CheckContext.accurateTokens`. TOKEN-01 labels the number `exact` vs `rough est`.

### Rubric & scoring

Six weighted categories (Build Bible §3.4): correctness 20%, triggering 22%, clarity 18%,
token 15%, safety 15%, verifiability 10%. The rubric is **versioned** (`RUBRIC_VERSION`) — a
rubric bump is a content/announcement event, so never change weights silently.

v0.1 only has checks in 4 of the 6 categories. Overall is computed over **evaluated categories
only, with weights renormalized**, and unevaluated categories are shown as "not yet scored".
This is deliberate honesty, not a bug — do not fake scores for categories without checks.

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
always-fresh-with-short-TTL. GitHub OAuth (`app/api/auth/github`) is built but gated on
`GITHUB_CLIENT_ID`/`SECRET` (returns 501 until set). Deploy target is Vercel (project + `skillcrossroads.com`
domain are Steve's to set up — not committed here).

**Gotcha:** the web app uses `moduleResolution: "bundler"`, so relative imports inside `apps/web`
take **no `.js` extension** (`./scan`, not `./scan.js`) — the opposite of core's NodeNext. Imports
from `@beacon/core` are fine (package resolution).

### Monetization (Sprint 8, open-core)

Stripe subscription checkout (`/api/checkout`, `mode:"subscription"`, **never** pass
`payment_method_types`) + webhook (`/api/stripe/webhook`, signature-verified) flip a **Pro
entitlement** (`lib/entitlements.ts` — in-memory now, **Postgres in production**). Pro unlocks
**private-repo scanning** (the user's OAuth token) and **managed LLM** (server
`BEACON_MANAGED_ANTHROPIC_KEY`, so TRIGGER-01 + exact tokens run without the user's key) via
`resolveScanOptions`. **The free tier must never depend on any of this** — every paid path is env-
gated and returns a clean 501 unconfigured; public deterministic scans always work. Stripe keys, the
DB, and the managed key are Steve-court (batched account setup).

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
`scanHistory` store (`lib/scans.ts`: `record` / `history` / `recent` / `stats`; memory + Postgres).
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
  repo; portfolio policy). Keep the Build Bible tracked and committed.

## CI / GitHub Action (Sprint 9)

The CLI is CI-native: a local path may be a **single skill or a folder of skills**
(`scanLocalDir` finds every `SKILL.md`); `--markdown` emits a PR-comment-ready report
(`renderMarkdown`, core); `--min-grade <G>` sets `process.exitCode = 1` when any skill grades below
`<G>` (`meetsMinGrade` / `gradeRank` in `score.ts`) — the CI gate. `apps/action` is a **composite**
GitHub Action (`action.yml` + `comment.mjs`, a dependency-free PR-comment poster that updates one
marker comment in place). The action runs `npx @sgharlow/beacon@latest`, so the "comments on a real PR" proof
is batched with the npm publish; the gate + markdown + local batch are live-proven via the CLI.

## Running locally

```bash
npm install
npm run build          # compile core, then cli, to dist/
node packages/cli/dist/cli.js ./path-to-a-skill
# or, from a global link:  beacon ./path-to-a-skill
npm test               # vitest
```
