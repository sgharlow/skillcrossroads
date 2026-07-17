# Community list / marketplace submissions (researched + verified live 2026-07-16)

Ranked by distribution value. Targets 1–2 are **human web-form submissions by the lists' own
rules** (no PR path exists); 3–4 are PR-able; 5–6 are skip/long-shot. Honest weakness across
all: the repo has ~1 GitHub star and no arms-length users yet — the Linting-peer precedent
(#1) and the mechanical validator (#4) are the strongest counters.

## 1. hesreallyhim/awesome-claude-code — 50.2k ★, THE list (Steve form, one click to prefill)

Their CONTRIBUTING bans PRs/CLI submissions — "resource recommendations must be created by
human beings" via the web issue form. **Prefilled form link (click, tick the 3 checkboxes,
submit):**

https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml&display_name=Skill+Crossroads&category=Linting&link=https%3A%2F%2Fgithub.com%2Fsgharlow%2Fskillcrossroads&author_name=sgharlow&author_link=https%3A%2F%2Fgithub.com%2Fsgharlow&description=Grades+Claude+Code+artifacts+%E2%80%94+skills%2C+subagents%2C+slash+commands%2C+.mcp.json+configs%2C+and+plugins+%E2%80%94+with+an+evidence-cited+scorecard+where+every+finding+carries+a+file%3Aline+citation%2C+producing+a+letter+grade+and+a+ranked+fix+list.+Open-core%3A+the+CLI+(npx+skillcrossroads)+and+public+scans+are+free%3B+ships+a+GitHub+Action+for+CI+grade-gating%2C+embeddable+badges%2C+and+a+Claude+Code+plugin+with+an+audit-skill.

- Category `Linting` has direct peers already listed (agnix, Schliff, Ctxlint, Upkeep) — the
  best acceptance argument. Maintainer prefers tools with existing users; rejection possible.
- MIT LICENSE present (their bot auto-checks) ✓. Form was actively processing submissions in
  the last 24h (verified).

## 2. anthropics/claude-plugins-community — official marketplace (Steve form)

PRs auto-closed; submit at **https://clau.de/plugin-directory-submission** (Anthropic review +
automated security scan → nightly sync). Listing yields `claude plugin install
skillcrossroads@claude-community` — highest leverage single listing.

Paste-ready description:
> Audit Claude Code artifacts from inside Claude Code. Installs the audit-skill, which runs the
> free skillcrossroads CLI to grade skills, subagents, slash commands, .mcp.json configs, and
> plugins — an evidence-cited file:line scorecard with a letter grade and a ranked fix list.
> Open-core; the CLI and public scans are free.

Risk: plugin shells out to `npx skillcrossroads` — read-only analysis, should pass their scan.

## 3. ComposioHQ/awesome-claude-skills — 67.9k ★ (PR-able; activity borderline, 55 days)

- File: `README.md` → `### Development & Code Tools`, alphabetical at "S".
- Entry line (their format):
  `- [Skill Crossroads](https://github.com/sgharlow/skillcrossroads) - Audits Claude Code artifacts (skills, subagents, slash commands, MCP configs, plugins) and returns an evidence-cited quality scorecard — file:line citations, a letter grade, and a ranked fix list. Free CLI via \`npx skillcrossroads\`; includes a GitHub Action for CI grade-gating and an audit-skill plugin. *By [@sgharlow](https://github.com/sgharlow)*`
- PR title: `Add Skill Crossroads to Development & Code Tools`
- PR body: `Adds Skill Crossroads, an open-core grader for Claude Code artifacts (skills, subagents, slash commands, .mcp.json configs, plugins). The CLI is free (npx skillcrossroads, MIT) and produces evidence-cited scorecards where every finding carries a file:line citation; a GitHub Action can gate CI on a minimum grade. Entry placed alphabetically under Development & Code Tools; links verified live.`
- Precedent: section already lists external tool links. Risk: repo may be slow to merge.

## 4. jeremylongshore/claude-code-plugins-plus-skills (tonsofskills.com) — 2.5k ★ (PR-able, validator-gated)

- Requires vendoring the plugin into their catalog + `marketplace.extended.json`; their `ccpi
  validate` + public 100-point rubric gate the merge ("C-grade rejects"). The vendored
  SKILL.md needs their 8 frontmatter fields added (name/description/allowed-tools/version/
  author/license/compatibility/tags). Real work (~1h) + an ongoing vendored copy to maintain.
- Upside: their rubric grading the grader is a credible story either way.

## 5. davepoon/buildwithclaude — 3.2k ★ — SKIP for now

External tools enter via marketplace auto-indexing (needs a `marketplace.json` we don't have);
vendoring the skill duplicates #4 for less reach. Re-check their site for a submit flow later.

## 6. jqueryscript/awesome-claude-code — 467 ★ — long shot

Tools section is stars-descending with a ~2.2k floor; at ~1 star this likely gets ignored.
Lowest priority; entry line drafted in the research if ever wanted.

## Ruled out (verified stale/wrong-fit)

travisvn/awesome-claude-skills (stale 79d), langgptai/awesome-claude-prompts (prompts-only),
mahseema/awesome-ai-tools (stale since Dec 2025), ccplugins/awesome-claude-code-plugins (stale
9mo), VoltAgent/awesome-claude-code-subagents + wshobson/agents (no external-tools section).
