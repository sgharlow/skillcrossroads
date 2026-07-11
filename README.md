# Skill Crossroads

**Know before you ship.** The signpost for Claude Code skills, agents, and MCP servers —
live at [skillcrossroads.com](https://skillcrossroads.com).

[![Skill Crossroads — live scorecard](https://img.shields.io/badge/skill%20crossroads-live%20scorecard-2ea043)](https://skillcrossroads.com/s/anthropics/skills) &nbsp; ![rubric v1.1](https://img.shields.io/badge/rubric-v1.1-555)

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
# from source (see Status below)
git clone <this-repo> && cd skillcrossroads
npm install && npm run build
node packages/cli/dist/cli.js ./path-to-a-skill

# also write a shareable HTML scorecard and an SVG badge:
node packages/cli/dist/cli.js ./path-to-a-skill --html --badge

# from npm (installed command is `skillcrossroads`):
npx skillcrossroads ./path-to-a-skill
```

### Subagents and slash commands too

The same rubric grades **subagents** (`.claude/agents/*.md`) and **slash commands**
(`.claude/commands/*.md`) — auto-detected from the path, or forced with `--kind`:

```bash
skillcrossroads .claude/agents/code-reviewer.md    # one agent
skillcrossroads .claude                            # every skill, agent, and command in one batch
skillcrossroads my-prompt.md --kind=command        # bare .md file, kind stated
```

Kind-aware grading: commands may omit frontmatter (valid-but-undiscoverable warns instead of
fails), agents are checked for typo'd `model:` values (AGENT-01) and for the
inherits-every-tool trap when no `tools:` list is declared (SAFETY-02), and commands for
`$ARGUMENTS`/`argument-hint` agreement (CMD-01). Skill-only structure checks (supporting-file
refs, progressive disclosure) are skipped for single-file artifacts, disclosed as unscored.
Hosted scans (`/s/owner/repo` and badges) include agents and commands too.

### MCP configs (`.mcp.json`)

Phase A of MCP support grades your **MCP configuration** — deterministic, evidence-cited:

```bash
skillcrossroads .mcp.json          # auto-detected (or --kind=mcp)
```

Checks: valid config shape (MCP-01), **version-pinned `npx` server packages** — an unpinned
server ships whatever is latest straight into your session (MCP-02), **TLS on remote
transports** (MCP-03), and the standard secret scan on inline `env` values (SAFETY-01) —
including JSON-style `"DB_PASSWORD": "…"` assignments.

**Phase B — grade the servers themselves** (explicit opt-in, local only):

```bash
skillcrossroads .mcp.json --mcp-live
```

`--mcp-live` spawns each **stdio** server from *your own config*, performs the MCP handshake,
and grades what comes back: servers answer `tools/list` (MCPT-01), **tool descriptions anchor
invocation** — the "will the model ever pick this tool?" floor (MCPT-02), and input parameters
are documented (MCPT-03). URL transports are skipped; the hosted site never spawns servers.

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

Or skip the copy-paste entirely — `init` puts the hosted badge in for you:

```bash
skillcrossroads init            # in your repo: adds the badge under your README's H1
skillcrossroads init --dry-run  # preview the change first
```

It reads your repo's `owner/repo` from the git remote (override with `--repo owner/name`),
confirms there are gradeable artifacts, and inserts the always-fresh linked badge — creating a
minimal README if you don't have one. It never commits; review the diff and commit yourself.

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
│  Overall: B−  (83/100)          rubric v1.1 · deterministic    │
├───────────────────────────────────────────────────────────────┤
│  Correctness & Structure   ████████████████░░░░  82   ⚠ 1      │
│  Clarity & Instructions    ██████████████████░░  90   ✓        │
│  Token & Context Cost      ████████████████████  95   ✓        │
│  Safety & Security         ████████████████░░░░  80   ⚠ 1      │
│  Triggering & Discovery    ███████████████░░░░░  76   ✓        │
│  Verifiability & Maint.    ██████████████░░░░░░  70   ✓        │
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

## The scoring rubric (v1.1)

> **v1.1 (2026-07):** deterministic Triggering (TRIGGER-02/03 description heuristics) and
> Verifiability (VERIFY-01 evals-present) checks — **keyless skill scans now score all six
> categories** (no more partial asterisk for skills). A key still upgrades Triggering to the
> LLM verdict and adds VERIFY-04/CLARITY-05.

Six weighted categories. Each runs individual **checks**; each check emits pass / warn / fail
plus evidence. Category scores roll up to an overall 0–100 and a letter grade.

| Category | Weight | Checks (rubric v1.1) |
|---|---|---|
| Correctness & Structure | 20% | valid frontmatter, recommended fields, references resolve; valid agent `model:` (AGENT-01); valid MCP config (MCP-01); plugin manifest validity + component resolution (PLUGIN-01/02) |
| Triggering & Discoverability | 22% | description length + invocation cues (TRIGGER-02/03, deterministic); plugin marketplace description (PLUGIN-03); triggers reliably *(LLM-assisted, BYOK)* |
| Clarity & Instruction Quality | 18% | no ASCII-art/persona filler; `argument-hint` agreement (CMD-01); constraints & failure modes stated *(LLM)* |
| Token & Context Cost | 15% | body budget, progressive disclosure, description footprint (exact `count_tokens` with a key) |
| Safety & Security | 15% | no hardcoded secrets (incl. JSON env values), `allowed-tools`/`tools` least-privilege, no destructive auto-invocation, no `!`-block shell injection, pinned MCP servers + TLS transports (MCP-02/03), hooks destructive-command sweep (HOOK-01) |
| Verifiability & Maintainability | 10% | evals/tests present (VERIFY-01, deterministic); verification step quality *(LLM-assisted, BYOK)* |

The rubric is **versioned** (`RUBRIC_VERSION` in `@beacon/core`); the implemented check catalog
is [`packages/core/src/checks/index.ts`](./packages/core/src/checks/index.ts), with more checks
on the roadmap. **Every check has a reference page** — what it looks for, why it matters, and
how to fix it, with examples — at
[skillcrossroads.com/docs/checks](https://skillcrossroads.com/docs/checks); findings on every
surface (scorecard, PR comment, annotations, terminal) link to their check's page.

**Partial grades are kind-aware:** a grade is marked partial (`*` on the badge) only when a
category that *could* score for that artifact kind went unscored — e.g. keyless LLM checks, or
a `.mcp.json` scanned without `--mcp-live`. Categories that structurally don't apply to a kind
(Triggering for an explicitly-invoked slash command) show as "n/a" and never mark the grade
partial, so a fully-keyed command scan is a full grade.

## Configuration (`.skillcrossroads.json`)

Place a `.skillcrossroads.json` in the scanned directory (or the directory you run from) to
tune CI/local scans — **every suppression requires a reason, is always disclosed on the
scorecard, and `SAFETY-*` checks can never be suppressed**:

```json
{
  "ignore": [{ "id": "TOKEN-02", "reason": "single-file skill by design" }],
  "minGrade": "B"
}
```

`minGrade` sets the default CI gate when `--min-grade` isn't passed. Hosted scans on
skillcrossroads.com never apply a repo's config — a public grade always reflects the full rubric.

Full-rubric scorecards also show an ecosystem percentile — *"scores higher than ≈N% of 214
public skills"* — derived from the published [State of Skills](https://skillcrossroads.com/report)
grade distribution (an interpolated estimate, hence the ≈; partial/keyless grades don't show it).

## Use it from inside Claude Code

This repo ships an [`audit-skill`](./skill/SKILL.md) Skill: install it and say *"audit my
skill"* — Claude runs the CLI, walks the ranked fix list, applies fixes, and re-grades until the
score stops improving. (It grades A on its own rubric, and CI enforces that on every PR.)

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
- **Account self-service** — `/account` shows your GitHub identity, plan (Free/Pro), and your recent
  scans. **Manage / cancel** your subscription via the Stripe Customer Portal (`/api/billing/portal`
  — no card data touches the app), and **sign out** (`/api/auth/logout`). The `init` CLI command
  (`skillcrossroads init`) drops the always-fresh badge into your README.
- **Public gallery** — `/gallery`, a leaderboard of opted-in scored skills (opt in via
  `/api/gallery/opt-in`), server-rendered and SEO-indexed (`sitemap.xml` + `robots.txt`), with
  sort (score / recent / name) and filter (min-grade / search).
- **Score history & trends** — every scan is recorded; `/trends/owner/repo/path` shows a
  self-contained SVG trend chart of a skill's grade over time, and `/dashboard` is a metrics view
  (total scans, skills tracked, grade distribution, recent activity).

Run locally: `cd apps/web && npm run dev`. Set `GITHUB_TOKEN` for higher GitHub rate limits.

## Status

**Live in production** — the hosted app (public scorecards, always-fresh badges, gallery, trends,
and the published [State of Claude Code Skills report](https://skillcrossroads.com/report)) is
`live-proven` at [skillcrossroads.com](https://skillcrossroads.com), and the CLI is published on
npm as [`skillcrossroads`](https://www.npmjs.com/package/skillcrossroads). **Nineteen
deterministic checks** across skills, subagents, slash commands, and `.mcp.json` configs — plus
three live MCP server checks behind `--mcp-live` and three LLM-assisted checks (BYOK) —
**TRIGGER-01** (triggering; verdicts matched a hand-labeled 14-skill set at **92.9%** against the
live API, run `npm run eval:triggering`), **VERIFY-04** (verification quality), and
**CLARITY-05** (constraints & failure modes). Keyless **skill** scans score all six rubric
categories (rubric v1.1); a key upgrades triggering to the LLM verdict. Scans run on local paths,
pasted files (skillcrossroads.com/paste), or **any public GitHub repo by URL** (batch, including
its agents/commands/MCP configs); six output surfaces (terminal, self-contained HTML, SVG badge,
Markdown, JSON, GitHub annotations). The source report is generated from live scans
(`npm run report:skills`). Honest remainder: the Stripe Pro tier and GitHub sign-in are
configured and owner-dogfooded but not yet customer-proven, and plugin scoring is on the roadmap.

## License

MIT — see [`LICENSE`](./LICENSE).
