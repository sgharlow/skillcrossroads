# Skill Crossroads

**Know before you ship.** The signpost for Claude Code skills, agents, and MCP servers.

[![Skill Crossroads — live scorecard](https://img.shields.io/badge/skill%20crossroads-live%20scorecard-2ea043)](https://skillcrossroads.com/s/anthropics/skills) &nbsp; ![rubric v1.0](https://img.shields.io/badge/rubric-v1.0-555)

Every skill hits a crossroads before you ship it. Skill Crossroads reads a Claude Code artifact — a
**Skill**, subagent, MCP server, or plugin — against an evidence-based rubric and points you one of
three ways: **ship, fix, or rethink**. You get a letter grade, an embeddable badge, and a fix list —
every finding cited to a file and line.

- **Ship** — grade A/B. It is ready. Here is your badge.
- **Fix** — grade C/D. Specific, evidence-cited problems to correct first.
- **Rethink** — grade F. Fundamental issues (will not trigger, unsafe, untested).

> Anthropic's `skill-creator` measures *effectiveness* (does the skill lift task success?).
> Skill Crossroads grades *craftsmanship and safety* (is it well-built, discoverable, and safe to ship?).
> They complement each other. No one else owns the graded-scorecard-plus-badge lane.

> **Note:** the CLI is published on npm as `skillcrossroads` (`npx skillcrossroads ./my-skill`).
> Internal workspace package names (`@beacon/core`) and `BEACON_*` env vars keep the original
> codename by design — only the published CLI and the product brand are "Skill Crossroads".

## Why

The #1 real-world skill failure is *"my skill never fires."* The #2 is *"it works on my
machine but ships with a hardcoded key / an over-broad tool grant / no tests."* Skill Crossroads catches
those **before you publish**, with file-and-line receipts — not vibes.

## Install & use

```bash
# from source (v0.1 — see Status below)
git clone <this-repo> && cd skillcrossroads
npm install && npm run build
node packages/cli/dist/cli.js ./path-to-a-skill

# also write a shareable HTML scorecard and an SVG badge:
node packages/cli/dist/cli.js ./path-to-a-skill --html --badge

# from npm (installed command is `skillcrossroads`):
npx skillcrossroads ./path-to-a-skill
```

### Scan a whole GitHub repo (no clone)

Point Skill Crossroads at a public repo and it grades every skill it finds — fetched via the GitHub API,
nothing cloned on your side:

```bash
skillcrossroads https://github.com/anthropics/skills        # batch table of every skill
skillcrossroads anthropics/skills --max=10                  # cap how many
skillcrossroads anthropics/skills --json                    # machine-readable, with the pinned tree sha
```

Set `GITHUB_TOKEN` for higher rate limits on large repos.

### Share the result

```bash
skillcrossroads ./my-skill --html --badge
#   wrote HTML → my-skill.beacon.html     ← self-contained, open or share it
#   wrote SVG  → my-skill.beacon.svg      ← drop it in your README
```

Then embed the badge in your skill's README — the local file, or (recommended) the hosted
**always-fresh** badge wrapped in a link to your public scorecard, so every visitor who sees it
can click through and scan their own skill:

```markdown
<!-- local static badge -->
![Skill Crossroads](./my-skill.beacon.svg)

<!-- hosted: re-scans on its own, links to the full scorecard -->
[![Skill Crossroads](https://skillcrossroads.com/api/badge/OWNER/REPO.svg)](https://skillcrossroads.com/s/OWNER/REPO)
```

### LLM-assisted triggering check (BYOK)

The highest-value check — *"will this skill actually fire?"* — uses a model. Bring your own
Anthropic key; deterministic checks always run without one.

```bash
export ANTHROPIC_API_KEY=sk-ant-...      # your key; nothing is sent without it
skillcrossroads ./my-skill                        # now also scores Triggering & Discoverability
BEACON_MODEL=claude-haiku-4-5 skillcrossroads ./my-skill   # cheaper model
```

Verdicts are cached by content hash in `.beacon-cache/`, so re-scanning an unchanged skill is
free. Without a key, Skill Crossroads runs deterministic-only and marks Triggering as "not yet scored."

A key also switches the token estimate to an **exact `count_tokens`** figure — the same tokenizer
Claude Code's `/context` uses, so it's the same number a skill actually costs. Offline, Skill Crossroads shows
a clearly-labeled rough estimate (skill markdown tokenizes denser than prose, so it can be ~10–25% off).

## What a report looks like

```
┌───────────────────────────────────────────────────────────────┐
│  CROSSROADS SCORECARD                      recipe-001          │
│  Overall: C+  (78/100)          rubric v1.0 · deterministic    │
├───────────────────────────────────────────────────────────────┤
│  Correctness & Structure   ████████████████░░░░  82   ⚠ 1      │
│  Clarity & Instructions    ██████████████████░░  90   ✓        │
│  Token & Context Cost      ████████████████████  95   ✓        │
│  Safety & Security         ████████████████░░░░  80   ⚠ 1      │
│  Triggering & Discovery         not yet scored (v0.1)          │
│  Verifiability & Maint.         not yet scored (v0.1)          │
└───────────────────────────────────────────────────────────────┘

TOP FIXES (ranked by score impact)

✗ STRUCT-05  Supporting-file reference does not resolve.
   Evidence: SKILL.md:14 links `./references/converter.md` — file not
   found in the skill directory. Fix: add the file or remove the link.

⚠ SAFETY-01  Possible hardcoded secret.
   Evidence: SKILL.md:22 matches an API-key pattern. Fix: move to an
   env var and reference it by name.
```

The voice is the product: **evidence-cited, "claimed vs. verified," no false confidence.**

## The scoring rubric (v1.0)

Six weighted categories. Each runs individual **checks**; each check emits pass / warn / fail
plus evidence. Category scores roll up to an overall 0–100 and a letter grade.

| Category | Weight | Checks in v0.1 |
|---|---|---|
| Correctness & Structure | 20% | valid frontmatter, recommended fields, references resolve |
| Triggering & Discoverability | 22% | description triggers reliably *(LLM-assisted, BYOK)* |
| Clarity & Instruction Quality | 18% | no ASCII-art/persona filler; constraints & failure modes stated *(LLM)* |
| Token & Context Cost | 15% | body budget, progressive disclosure, description footprint (exact `count_tokens` with a key) |
| Safety & Security | 15% | no hardcoded secrets, `allowed-tools` least-privilege, no destructive auto-invocation, no `!`-block shell injection |
| Verifiability & Maintainability | 10% | verification step present *(LLM-assisted, BYOK)* |

The rubric is **versioned** — see [`Skill-Crossroads-Build-Bible.md`](./Skill-Crossroads-Build-Bible.md) for the full
~24-check catalog and roadmap.

## Continuous integration (GitHub Action)

Gate skill quality on every PR in three lines — the Action grades your skills, **comments a
scorecard**, and **fails the build** below a grade you pick (full docs: [`apps/action`](./apps/action)):

```yaml
- uses: actions/checkout@v4
- uses: sgharlow/skillcrossroads/apps/action@v1
  with: { path: ./skills, min-grade: B }
```

The CLI is CI-native on its own, too:

```bash
skillcrossroads ./skills --markdown          # a Markdown report (job summary / PR comment)
skillcrossroads ./skills --min-grade B       # exit non-zero if any skill is below B (the gate)
```

A local path may be a single skill or a **folder of skills** — every `SKILL.md` under it is scanned.

## Hosted web app (`@beacon/web`)

A Next.js app (in `apps/web`) serves the shareable side of Skill Crossroads — it reuses `@beacon/core`:

- **Public scorecard pages** — `/s/owner/repo/path/to/skill` renders the scorecard HTML
  scorecard (a repo URL renders a summary of every skill). Mobile-responsive, self-contained.
- **Always-fresh badge endpoint** — `/api/badge/owner/repo/path.svg` returns the SVG grade badge,
  scanned live with a short CDN TTL so it updates on re-scan.
- **JSON API** — `/api/scan?repo=owner/repo`.
- **GitHub OAuth** — `/api/auth/github` (build-ready; set `GITHUB_CLIENT_ID`/`SECRET` to enable).
- **Pro tier (open-core)** — `/pricing` (Free / Pro $19 / Team $99). Stripe subscription checkout
  (`/api/checkout` + `/api/stripe/webhook`), Pro entitlements, and Pro-only **private-repo scanning**
  + **managed LLM** (no user key needed). All gated on `STRIPE_*` / `BEACON_MANAGED_ANTHROPIC_KEY`
  env vars — the **free tier is unaffected** when they're unset.
- **Public gallery** — `/gallery`, a leaderboard of opted-in scored skills (opt in via
  `/api/gallery/opt-in`), server-rendered and SEO-indexed (`sitemap.xml` + `robots.txt`), with
  sort (score / recent / name) and filter (min-grade / search).
- **Score history & trends** — every scan is recorded; `/trends/owner/repo/path` shows a
  self-contained SVG trend chart of a skill's grade over time, and `/dashboard` is a metrics view
  (total scans, skills tracked, grade distribution, recent activity).

Run locally: `cd apps/web && npm run dev`. Set `GITHUB_TOKEN` for higher GitHub rate limits.

## Status

**v0.1 — `built`; CLI, repo-scanning, exact token counts, local multi-skill scanning, Markdown
reports, and score-gating `live-proven` locally; the hosted web app `live-proven` locally; the
Stripe paywall, Pro features, PR-comment bot, and the public gallery `wired` (opt-in flow, sort,
filter, and SEO live-proven locally; persistence/cross-instance sharing needs the batched DB).** Eleven deterministic checks (structure, a three-check **Token & Context Cost**
pack, clarity, and a four-check **Safety & Security** pack: secrets, `allowed-tools`
over-permissioning, destructive auto-invocation, `!`-block shell injection) on a local Skill
directory or **any public GitHub repo by URL** (batch); three output surfaces
(terminal scorecard, self-contained HTML report, embeddable SVG badge); plus three LLM-assisted
checks (BYOK) — **TRIGGER-01** (triggering; verdicts matched a hand-labeled 14-skill set at **92.9%**
against the live API, run `npm run eval:triggering`), **VERIFY-04** (verification step present), and
**CLARITY-05** (constraints & failure modes) — so **all six rubric categories score with a key**. A batch
["State of Claude Code Skills" report](./reports/state-of-claude-code-skills.md) is generated from
live scans (`npm run report:skills`). Hosted reports with always-fresh badges, CI, and
agent/MCP/plugin scoring are on the roadmap (Build Bible, Part 5).

## License

MIT — see [`LICENSE`](./LICENSE).
