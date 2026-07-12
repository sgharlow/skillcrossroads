# The State of Claude Code Skills

*An evidence-based audit of 214 public Claude Code skills across 18 repositories, graded by **Skill Crossroads** — the signpost for Claude Code artifacts. Includes the LLM-assisted triggering check. Every figure is traceable to the pinned git trees in the methodology.*

> **Edition & pinning.** Generated **2026-07-09** under **rubric v1.0, LLM (full) edition**. The
> rubric is versioned and has since moved on (the live scanner runs a later rubric with more
> deterministic checks, so scanning these same repos today produces different — generally
> higher — deterministic figures). This report is a pinned snapshot: its numbers are exact for
> the trees and rubric named here, and are not regenerated when the rubric changes.

> **Scope.** A deliberately mixed sample: Anthropic's well-maintained `anthropics/skills` catalog alongside a spread of community-authored repos (up to 12 skills each). This is a read on skills people actually publish — not a curated best-of.

## The headline

**Among skills Skill Crossroads could score, 73% have a description that won't reliably trigger** — 93 (43%) outright unlikely to fire, 63 (29%) borderline. "My skill never fires" is the #1 real-world skill failure, and it hides in the frontmatter `description`.

Skill Crossroads scored **214 of 214** skills for triggering.

The average Skill Crossroads score across all 214 skills is **73.6/100**.

## Will your skill even fire? (Triggering & Discoverability)

How the LLM triggering check graded each description:

```
fires reliably (pass)   █████░░░░░░░░░░░░░░░  27%  (58)
borderline    (warn)    ██████░░░░░░░░░░░░░░  29%  (63)
won't fire    (fail)    █████████░░░░░░░░░░░  43%  (93)
```

A description fails when it reads like a title, buries the use case, omits the natural-language phrases a user would actually say, or is so broad it never anchors. All of it is fixable **before** you publish — that's the point of the check.

## Grade distribution

| Grade | Skills | Share |
|---|---|---|
| A | 1 | 0% |
| B | 37 | 17% |
| C | 113 | 53% |
| D | 52 | 24% |
| F | 11 | 5% |

## How skills do on each check

Share of skills that **pass cleanly** (higher is better):

```
STRUCT-01 valid YAML frontmatter               ███████████████████░  97%   n=214 (0 warn, 6 fail)
STRUCT-02 recommended fields present           ███████████████████░  94%   n=214 (7 warn, 6 fail)
STRUCT-05 supporting-file references resolve   ███████████████████░  95%   n=214 (0 warn, 10 fail)
TOKEN-01 under the line/token budget           ██████████████████░░  90%   n=214 (16 warn, 5 fail)
TOKEN-02 progressive disclosure                ████████████████░░░░  79%   n=214 (45 warn, 0 fail)
TOKEN-03 description budget footprint          ████████████████████  99%   n=214 (2 warn, 0 fail)
CLARITY-03 no ASCII-art / persona filler       ███████████████████░  95%   n=214 (5 warn, 5 fail)
SAFETY-01 no hardcoded secrets                 ████████████████████  99%   n=214 (0 warn, 3 fail)
SAFETY-02 allowed-tools least-privilege        ████████████████████  99%   n=214 (3 warn, 0 fail)
SAFETY-03 no destructive auto-invocation       █████████████████░░░  87%   n=214 (28 warn, 0 fail)
SAFETY-04 no shell-injection in ! blocks       ████████████████████ 100%   n=214 (0 warn, 0 fail)
TRIGGER-01 description triggers reliably       █████░░░░░░░░░░░░░░░  27%   n=214 (63 warn, 93 fail)
CLARITY-05 constraints & failure modes stated  ░░░░░░░░░░░░░░░░░░░░   0%   n=214 (12 warn, 201 fail)
VERIFY-04 verification step present            ░░░░░░░░░░░░░░░░░░░░   2%   n=214 (7 warn, 203 fail)
```

_LLM checks (TRIGGER-01, CLARITY-05, VERIFY-04) show a smaller `n` than the deterministic checks when calls were dropped on transient model/network errors — each percentage is over the skills that check actually scored._

## What this means

**0 of 214 skills (0%)** pass every check Skill Crossroads ran, cleanly.

The most common defects across the sample:

- constraints & failure modes stated (CLARITY-05): 213 of 214
- verification step present (VERIFY-04): 210 of 214
- description triggers reliably (TRIGGER-01): 156 of 214
- progressive disclosure (TOKEN-02): 45 of 214
- no destructive auto-invocation (SAFETY-03): 28 of 214
- under the line/token budget (TOKEN-01): 21 of 214
- recommended fields present (STRUCT-02): 13 of 214
- supporting-file references resolve (STRUCT-05): 10 of 214
- no ASCII-art / persona filler (CLARITY-03): 10 of 214
- valid YAML frontmatter (STRUCT-01): 6 of 214

Each is catchable **before** publishing, with `npx skillcrossroads ./your-skill` — and each is exactly the kind of thing that makes a good skill look broken in someone else's session.

## Methodology & reproducibility

Skill Crossroads' deterministic checks (no LLM) plus the LLM-assisted triggering check (TRIGGER-01) were run against each repo's git tree at the sha below, under **rubric v1.0** (11 deterministic + 3 LLM checks — the catalog as of 2026-07-09). Deterministic figures are bit-reproducible from those trees **with the v1.0 engine**; LLM verdicts are content-hash cached and pinned to the same trees, but model output is not guaranteed bit-identical across runs.

> **Discovery update (v0.11.2, 2026-07-11):** this edition ran with discovery that included
> skills found inside `test/` and `fixtures/` trees. Discovery now excludes them — a repo's
> public grade should describe what it ships, not its test data. Re-running against the same
> pinned trees with current discovery can therefore yield slightly lower per-repo skill counts
> (fixture skills dropped); artifact-level grades are unaffected. The next edition will use the
> new rule throughout.

| Repo | Ref | Tree sha | Skills | Errors |
|---|---|---|---|---|
| anthropics/skills | main | `9d2f1ae18723` | 12 | 0 |
| diegosouzapw/awesome-omni-skill | main | `a6b3c3005ced` | 12 | 0 |
| lionelsimai/claude-skills-collection | main | `5c3b481f1879` | 12 | 0 |
| membranedev/application-skills | main | `f484c8265e70` | 12 | 0 |
| Trompetilla/Skills | main | `a4277979986e` | 12 | 0 |
| LeoYeAI/openclaw-master-skills | main | `67e40a3ee347` | 12 | 0 |
| ComeOnOliver/skillshub | main | `def8531e6511` | 12 | 0 |
| agentskillexchange/skills | main | `561182614102` | 12 | 0 |
| ranbot-ai/awesome-skills | main | `12b433915a83` | 12 | 0 |
| inbharatai/claude-skills | main | `02077f8b2c05` | 12 | 0 |
| onfire7777/universal-ai-skills-library | main | `1e29cd14119f` | 12 | 0 |
| FridrichMethod/awesome-skills | main | `1380472e5c8c` | 12 | 0 |
| rootcastleco/rei-skills | main | `9990ea381cfa` | 12 | 0 |
| itsmostafa/aws-agent-skills | main | `4ab904a69cda` | 12 | 0 |
| kid-sid/claude-spellbook | main | `a51ebdd8902c` | 12 | 0 |
| Cortexa-LLC/ai-pack | main | `8c7debe195a9` | 10 | 0 |
| Sandeeprdy1729/skill_galaxy | main | `2dd36c8ab8f1` | 12 | 0 |
| excatt/superclaude-plusplus | main | `9c36a87a9edc` | 12 | 0 |

Reproduce: check out the engine at rubric v1.0 (repo history, 2026-07-09), then `npm run build && BEACON_LLM=1 ANTHROPIC_API_KEY=… node scripts/state-of-skills.mjs` (default repo set). Running the CURRENT engine reproduces the scan but not these figures — later rubrics add checks, which shifts scores. Pass `owner/repo …` to scan your own repos with today's rubric instead.
