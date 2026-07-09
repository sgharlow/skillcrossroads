# Beacon — Codebase Guide (CLAUDE.md)

> **Lighthouse for Claude Code artifacts.** Beacon audits a Claude Code artifact (Skill,
> subagent, MCP server, or plugin) and returns an evidence-cited quality scorecard with a
> letter grade, plus an embeddable badge. The full product spec lives in
> [`Beacon-Build-Bible.md`](./Beacon-Build-Bible.md) — read it before making product decisions.

## What this repo is (and is not)

Beacon is **open-core**: the CLI and public audits are free (that is the marketing / badge
loop); money is the hosted tier (private-repo scanning, CI gating, dashboards — not built yet).
This repo currently implements **Sprint 1 / v0.1** only.

**v0.1 scope (what exists now):** the `@beacon/core` engine + the `beacon` CLI, running
**deterministic, no-LLM, no-network** checks on a **local Skill** directory. Three output
surfaces: a terminal scorecard, a **self-contained HTML report** (`renderHtml`), and an
**embeddable SVG badge** (`renderBadge`) — all with an overall 0–100 score and letter grade.

**Explicitly NOT in v0.1** (later sprints, each a shippable win — do not add speculatively):
LLM-assisted checks, hosted backend / always-fresh badge endpoint, auth, billing,
agents/MCP/plugin scoring, GitHub Action / CI, the public gallery.

The visual renderers (`render/html.ts`, `render/badge.ts`) share one hex palette in
`render/theme.ts` (the "harbor marker light" scheme); the terminal renderer uses picocolors
separately. HTML output must stay **fully self-contained** — no external asset requests, all CSS
inlined — and must **escape** every dynamic value (a scanned skill is untrusted input).

## The claim ladder (honest status, always)

Never write "DONE" bare. This repo's status: **v0.1 is `built` (code + tests green)** — it is
NOT `live-proven` (no public users), NOT `dogfooded` end-to-end beyond local smoke runs.
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

The v0.1 catalog (deterministic): `STRUCT-01` valid YAML frontmatter · `STRUCT-02` recommended
fields present · `STRUCT-05` supporting-file references resolve · `TOKEN-01` body under
line/token budget · `CLARITY-03` no ASCII-art/persona filler · `SAFETY-01` no hardcoded
secrets. Full ~24-check catalog is Appendix C of the Build Bible.

### Rubric & scoring

Six weighted categories (Build Bible §3.4): correctness 20%, triggering 22%, clarity 18%,
token 15%, safety 15%, verifiability 10%. The rubric is **versioned** (`RUBRIC_VERSION`) — a
rubric bump is a content/announcement event, so never change weights silently.

v0.1 only has checks in 4 of the 6 categories. Overall is computed over **evaluated categories
only, with weights renormalized**, and unevaluated categories are shown as "not yet scored".
This is deliberate honesty, not a bug — do not fake scores for categories without checks.

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

## Running locally

```bash
npm install
npm run build          # compile core, then cli, to dist/
node packages/cli/dist/cli.js ./path-to-a-skill
# or, from a global link:  beacon ./path-to-a-skill
npm test               # vitest
```
