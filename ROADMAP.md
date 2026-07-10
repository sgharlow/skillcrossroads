# Skill Crossroads — Roadmap

> **Authoritative forward plan** (2026-07-10). The original 12-sprint build plan (private Build
> Bible) is complete: engine, CLI, hosted app, Action, report, and billing are live at
> [skillcrossroads.com](https://skillcrossroads.com) and the money path is dogfooded. This roadmap
> covers what comes next. Claim-ladder language throughout (built → wired → live-proven →
> dogfooded → customer-used → revenue-proven) — nothing here is "DONE" bare.

## Positioning & competitors

Skill Crossroads grades **craftsmanship and safety** of Claude Code artifacts with evidence-cited,
file-and-line receipts. Adjacent tools: **Anthropic's `skill-creator`** (measures task-success
*effectiveness* — complementary, not competing), and the crowd of `skill*` utilities
(SkillCheck, Skill Linter, SkillsBench, Skill Benchmarker) that lint structure without a graded
scorecard, badge loop, or published ecosystem data. No one else owns the
scorecard-plus-badge-plus-data-report lane. That lane is the moat; features below either deepen
it or are rejected.

## Monetization path

In-app billing is **live** (Stripe Pro $19/mo — private-repo scans, managed LLM, hosted badges,
history; dogfooded end-to-end 2026-07-10). Team ($99/mo) is advertised as *contact-us only* — a
deliberate willingness-to-pay probe, **not to be built** until a real prospect replies.
**Current WTP evidence: none ($0, zero external users).** Every sprint after Sprint 1 is gated on
demand evidence, not engineering appetite.

## Gate G0 — the launch (owner: Steve, target: within 14 days of this doc)

The channel test that everything downstream depends on: post the
[State of Claude Code Skills report](https://skillcrossroads.com/report) to 1–2 developer
communities (human-send by design).

- **Pass (any one, within 14 days of the post):** ≥1 stranger-initiated scan (gallery opt-in,
  badge embed in an external repo, or Action install), OR ≥25 unique `/report` readers with ≥3
  site scans, OR ≥1 Team-tier inquiry email.
- **Fail / pivot threshold:** two launch posts + 4 weeks → zero external scans ⇒ **stop feature
  work entirely**; the problem is channel or positioning, not product. Distribution experiments
  only until a signal exists.

## Ranked roadmap

Ranking = (developer value × demand-loop leverage) ÷ effort. Estimates are focused,
Claude-assisted dev-days including tests + deploy + live verification (repo discipline), with a
suggested calendar week per sprint at evenings/weekends pace.

### Sprint 1 — Adoption floor (launch-safe) · ~3.5 dev-days · 1 week
*These three de-risk the launch itself: the first blockers real users hit, and the two cheapest
demand amplifiers. No horizontal breadth.*

| # | Item | Why first | Est. |
|---|------|-----------|------|
| 1 | **Config + suppression** — `.skillcrossroads.json`: disable/ignore a check globally or per-skill (with a required `reason`), set `min-grade`, token-budget overrides; suppressions disclosed on the scorecard ("2 checks suppressed") so grades stay honest | The #1 linter-adoption blocker: one false positive in CI with no escape hatch = uninstall. Every peer tool ships this | 1.5d |
| 2 | **Percentile benchmark** — every scorecard/badge shows "beats N% of the 214 public skills scanned" (computed from the pinned report dataset; regenerated with each report edition) | Turns an opaque number into a shareable comparison; zero new data collection | 1d |
| 3 | **The `audit-skill` Skill** — a Claude Code skill (in-repo `skill/` + gallery-listed) that runs `npx skillcrossroads` on the user's skill and walks them through the fix list | Distribution inside the ecosystem being audited; must itself grade A (dogfood proof) | 1d |

### Sprint 2 — Tagline integrity: agents & commands · ~4.5 dev-days · 1–1.5 weeks · **gated on G0**
*The site says "skills, agents, and MCP servers"; the engine grades skills only. Close the gap
for the two artifact types that reuse the existing pipeline.*

| # | Item | Why | Est. |
|---|------|-----|------|
| 4 | Grade **subagents** (`.claude/agents/*.md`) and **slash commands** — artifact-kind detection, check applicability matrix (most checks apply as-is: triggering description, tool least-privilege, token cost, secrets) | Promise-integrity + doubles the addressable artifacts | 2d |
| 5 | 2–3 agent-specific checks (e.g. `allowed-tools` scope vs. stated purpose, model-field validity, missing-description detection) | The rubric must be real for the new kinds, not a relabel | 1.5d |
| 6 | Surfaces: CLI/web/Action/badge for the new kinds + a "State of Claude Code **Agents**" report edition (the launch content for this sprint) | Every capability ships with its demand loop | 1d |

### Sprint 3 — Funnel + CI depth · ~4 dev-days · 1 week · **gated on G0 sustained**

| # | Item | Why | Est. |
|---|------|-----|------|
| 7 | **Paste-to-scan** on the web — paste a `SKILL.md` (or drop a folder) → instant scorecard, no GitHub required | Today the web funnel dies for anyone whose skill isn't in a public repo — most skills mid-authoring | 2d |
| 8 | **PR annotations + grade delta** — Action emits `::warning file=…,line=…` inline annotations and "this PR: B → A−" base-vs-head delta in the comment | Findings in the diff where devs live; the delta makes quality visible per-change | 2d |

### Sprint 4 — Moat cadence + MCP decision · ~3.5 dev-days · 1 week · **gated on G1**
**Gate G1 (before this sprint):** ≥50 external scans/month OR ≥3 badges embedded in external
repos OR 1 paying Pro customer. Owner: Steve reviews numbers; date: at Sprint 3 close.

| # | Item | Why | Est. |
|---|------|-----|------|
| 9 | Check batch #1: 3 deterministic checks from the v1 catalog (deterministic triggering heuristics TRIGGER-02/03, evals-present VERIFY-01) — each shipped with a short evidence post | The "one new check = one content post" cadence is the compounding moat | 2d |
| 10 | **MCP-support spike** with a written PASS/FAIL gate: can static manifest/tool-description checks produce evidence-cited findings comparable to skill checks? PASS → schedule MCP sprint; FAIL → drop "MCP servers" from the tagline (honesty over aspiration) | Third tagline claim; spike-before-build on the riskiest scope | 1.5d |

### Deferred (build only on explicit demand evidence)
- **MCP server grading (full)** — pending the Sprint-4 spike gate
- **`--suggest`** LLM fix-generation (rewrite the failing description, BYOK) — after suppression
  ships and TRIGGER data shows which fixes users actually apply
- **SARIF output** → GitHub code-scanning tab — first enterprise-ish request triggers it
- **Team tier build-out** (org rules, seats, shared dashboard) — first real Team inquiry triggers it

### Rejected (anti-bloat, with reasons)
- **VS Code extension** — a second surface to maintain; the CLI + `audit-skill` Skill cover the workflow
- **GitLab/Bitbucket CI** — zero demand signal; GitHub is where the ecosystem lives
- **Custom rubric weights** — comparability across the ecosystem *is* the product; configurable
  weights fork the meaning of a grade
- **Web user accounts/profiles** — no users to profile; OAuth exists solely to gate Pro
- **Marketplace/site redesigns** — the funnel converts or it doesn't; measure first

## Post-launch branch plan
- **Win** (G0 passes): proceed Sprint 2 → 3 → G1 review.
- **Flat** (some readers, no scans): one positioning iteration + a second channel post; no code
  beyond Sprint 1 until a scan happens.
- **Zombie** (G0 fail threshold hit): stop feature work; site stays up (hosting ≈ $0, monitoring
  in place), npm stays published; quarterly re-review. No teardown needed — but no further build.
