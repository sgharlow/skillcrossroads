# HN relist — verified facts only (read 2026-09-26)

> **This sheet contains no sentences to post.** HN killed the 2026-09-17 Show HN because its text was LLM-shaped; moderator Daniel's guidance is to hand-write every word, including edits. Steve writes the comment and the reply. Claude's only role is these numbers, each checked against its source on the date shown. Rule: `feedback-claude-must-not-write-hn-text`.

## Where the two writes go
- Comment: HN item **49744398** (the killed Show HN; the relist happens on it, not as a new submission).
- Reply email: Gmail thread **1a0b08f5375c7d68** with hn@ycombinator.com (Daniel's 2026-09-17 18:36Z message).
- Any link posted **must carry `?ref=hn-show`** — the bare apex on 9-17 tagged nothing (534 scan rows, 100% `source = NULL`).

## Numbers live on skillcrossroads.com/report (re-read 2026-09-26)

| Number | What it is exactly | Denominator |
|---|---|---|
| **216** | public Claude Code skills in the corpus | across **18** repositories |
| **215** | skills scored for triggering | of 216 (one unscored) |
| **69%** | descriptions that won't reliably trigger | of **215**, i.e. 148 = 87 "unlikely to fire" (40%) + 61 "borderline" (28%) |
| **31%** | fire reliably (pass) | of 215 |
| **82.1 / 100** | average Skill Crossroads score | across all 216 |
| **1 of 216** | pass every check cleanly | 216 |
| A 7 · B 156 · C 45 · D 2 · F 6 | grade distribution | 216 (percentages on the page: 3 / 72 / 21 / 1 / 3) |
| **rubric v1.2** · **generated 2026-09-10** | edition string on the page | prior edition v1.0, 2026-07-09 |

## Percentile badge sample (source: `packages/core/src/percentile.ts`, read 2026-09-26)

| Number | What it is |
|---|---|
| **208** | percentile comparison sample, edition **2026-09**, deterministic rubric |
| 214 | the previous edition, 2026-07-11 — superseded |

⚠️ Known trap from the 9-17 post: pairing **216** with **69%** is wrong — the 69% is over **215**. ⚠️ The GitHub Action's PR comment may still print "≈99% of 214" (July dataset) while the live edition is 208; check the badge before it is linked.

## What is live (for "is it real" questions)
- `/report`, `/report-agents`, `/gallery`, `/api/health`, badge SVG: all serving (g0-baseline.md, 2026-07-16; re-probe before posting with `node scripts/hn-watch.mjs` or a browser).
- Attribution: `?ref` → `sc_ref` cookie (Max-Age 1800) → `scans.source`; the demand readout is `npm run report:demand` from `apps/web` (owner logins excluded).

## Open with Daniel (a fact, not a script)
- He answered the text question only. Whether a **standing penalty** sits on the account or the domain was asked on 9-17 and not answered.

## After the relist (Claude's part)
- `PROJECT.yaml` G0: set `relisted_on`, recompute `due = relisted_on + 14`, clear PROVISIONAL.
- `node scripts/hn-watch.mjs watch 49744398` (state file `.hn-watch-state.json`, last check 2026-09-17T22:04Z).
- Reddit was never posted; the kill clause counts two launch posts.
