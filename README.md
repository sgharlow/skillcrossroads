# Beacon

**Lighthouse for Claude Code artifacts.**

![Beacon: A−](https://img.shields.io/badge/Beacon-A%E2%88%92-2ea043) &nbsp; ![rubric v1.0](https://img.shields.io/badge/rubric-v1.0-555)

Beacon audits a Claude Code artifact — a **Skill**, subagent, MCP server, or plugin — and
returns an **evidence-cited quality scorecard with a letter grade**. It runs as a CLI today
(`beacon ./my-skill`), and — on the roadmap — in CI (a GitHub Action that comments on PRs) and
as a hosted web report with a shareable URL and an always-fresh embeddable badge.

> Anthropic's `skill-creator` measures *effectiveness* (does the skill lift task success?).
> Beacon grades *craftsmanship and safety* (is it well-built, discoverable, and safe to ship?).
> They complement each other. **No one else owns the graded-scorecard-plus-badge lane.**

## Why

The #1 real-world skill failure is *"my skill never fires."* The #2 is *"it works on my
machine but ships with a hardcoded key / an over-broad tool grant / no tests."* Beacon catches
those **before you publish**, with file-and-line receipts — not vibes.

## Install & use

```bash
# from source (v0.1 — see Status below)
git clone <this-repo> && cd beacon
npm install && npm run build
node packages/cli/dist/cli.js ./path-to-a-skill

# also write a shareable HTML scorecard and an SVG badge:
node packages/cli/dist/cli.js ./path-to-a-skill --html --badge

# once published to npm:
npx beacon ./path-to-a-skill
```

### Share the result

```bash
beacon ./my-skill --html --badge
#   wrote HTML → my-skill.beacon.html     ← self-contained, open or share it
#   wrote SVG  → my-skill.beacon.svg      ← drop it in your README
```

Then embed the badge in your skill's README:

```markdown
![Beacon](./my-skill.beacon.svg)
```

## What a report looks like

```
┌───────────────────────────────────────────────────────────────┐
│  BEACON SCORECARD                          recipe-001          │
│  Overall: B−  (78/100)          rubric v1.0 · deterministic    │
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
| Triggering & Discoverability | 22% | *(LLM-assisted — later sprint)* |
| Clarity & Instruction Quality | 18% | no ASCII-art/persona filler |
| Token & Context Cost | 15% | body under line/token budget |
| Safety & Security | 15% | no hardcoded secrets |
| Verifiability & Maintainability | 10% | *(later sprint)* |

The rubric is **versioned** — see [`Beacon-Build-Bible.md`](./Beacon-Build-Bible.md) for the full
~24-check catalog and roadmap.

## Status

**v0.1 — `built` (code + tests green), not yet `live-proven`.** Deterministic checks on a local
Skill directory, with three output surfaces: a terminal scorecard, a self-contained HTML report,
and an embeddable SVG badge. LLM-assisted checks, hosted reports with always-fresh badges, CI, and
agent/MCP/plugin scoring are on the roadmap (Build Bible, Part 5).

## License

MIT — see [`LICENSE`](./LICENSE).
