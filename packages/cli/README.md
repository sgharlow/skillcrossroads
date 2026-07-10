# Skill Crossroads

**Know before you ship.** The signpost for Claude Code skills, agents, and MCP servers — an
evidence-based quality scorecard, letter grade, and embeddable badge.

[![Skill Crossroads — live scorecard](https://img.shields.io/badge/skill%20crossroads-live%20scorecard-2ea043)](https://skillcrossroads.com/s/anthropics/skills)

```bash
npx skillcrossroads ./my-skill              # grade a local skill
npx skillcrossroads anthropics/skills       # grade every skill in a public repo (no clone)
npx skillcrossroads ./skills --markdown --min-grade=B   # CI: report + build gate
```

Every finding is cited to a file and line — **receipts, not vibes** — and points you one of
three ways: **ship** (A/B), **fix** (C/D), or **rethink** (F).

## What it checks

Six weighted rubric categories: Correctness & Structure, Triggering & Discoverability
(*"will it actually fire?"* — the #1 real-world skill failure), Clarity & Instructions,
Token & Context Cost, Safety & Security, and Verifiability & Maintainability.
11 deterministic checks run with zero configuration; set `ANTHROPIC_API_KEY` to add the
LLM-assisted checks (BYOK) and exact `count_tokens` figures.

## Share the result

```bash
npx skillcrossroads ./my-skill --html --badge
```

writes a self-contained HTML scorecard and an SVG badge — or embed the hosted, always-fresh
badge that re-scans on its own:

```markdown
[![Skill Crossroads](https://skillcrossroads.com/api/badge/OWNER/REPO.svg)](https://skillcrossroads.com/s/OWNER/REPO)
```

## More

- **Hosted scorecards, gallery, and the data report:** [skillcrossroads.com](https://skillcrossroads.com) ·
  [The State of Claude Code Skills](https://skillcrossroads.com/report)
- **GitHub Action (PR comments + quality gate):** [`sgharlow/skillcrossroads/apps/action@v1`](https://github.com/sgharlow/skillcrossroads/tree/main/apps/action)
- **Source:** [github.com/sgharlow/skillcrossroads](https://github.com/sgharlow/skillcrossroads) · MIT
