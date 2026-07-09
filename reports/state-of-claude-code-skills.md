# The State of Claude Code Skills

*An evidence-based audit of 18 public Claude Code skills, graded by **Beacon** — the Lighthouse for Claude Code artifacts. Deterministic checks only; every figure below is reproducible from the pinned git trees in the methodology.*

> **Scope of this edition.** These 18 skills come from the `anthropics/skills` catalog. Treat this as a **baseline on well-maintained skills**, not a survey of the whole ecosystem — community-marketplace editions are the natural next report, and the same command scans any public repo.

## The headline

Across 18 skills, the average Beacon score is **99.5/100**. The single most common problem is **under the line/token budget** (TOKEN-01): **11%** of skills don't cleanly pass it.

## Grade distribution

| Grade | Skills | Share |
|---|---|---|
| A | 18 | 100% |
| B | 0 | 0% |
| C | 0 | 0% |
| D | 0 | 0% |
| F | 0 | 0% |

## How skills do on each check

Share of skills that **pass cleanly** (higher is better):

```
STRUCT-01 valid YAML frontmatter               ████████████████████ 100%   (0 warn, 0 fail)
STRUCT-02 recommended fields present           ████████████████████ 100%   (0 warn, 0 fail)
STRUCT-05 supporting-file references resolve   ████████████████████ 100%   (0 warn, 0 fail)
TOKEN-01 under the line/token budget           ██████████████████░░  89%   (2 warn, 0 fail)
TOKEN-02 progressive disclosure                ███████████████████░  94%   (1 warn, 0 fail)
TOKEN-03 description budget footprint          ███████████████████░  94%   (1 warn, 0 fail)
CLARITY-03 no ASCII-art / persona filler       ████████████████████ 100%   (0 warn, 0 fail)
SAFETY-01 no hardcoded secrets                 ████████████████████ 100%   (0 warn, 0 fail)
SAFETY-02 allowed-tools least-privilege        ████████████████████ 100%   (0 warn, 0 fail)
SAFETY-03 no destructive auto-invocation       ████████████████████ 100%   (0 warn, 0 fail)
SAFETY-04 no shell-injection in ! blocks       ████████████████████ 100%   (0 warn, 0 fail)
```

## What this means

**15 of 18 skills (83%)** pass every deterministic check cleanly.

The defects that *did* surface, even in well-maintained skills:

- under the line/token budget (TOKEN-01): 2 of 18
- progressive disclosure (TOKEN-02): 1 of 18
- description budget footprint (TOKEN-03): 1 of 18

Each is catchable **before** publishing, with `npx beacon ./your-skill` — and each is exactly the kind of thing that makes a good skill look broken in someone else's session.

## Methodology & reproducibility

Beacon's deterministic checks (no LLM) were run against each repo's git tree at the sha below. Deterministic checks are pure, so re-scanning the same tree reproduces these figures exactly. The LLM-assisted triggering check was excluded here for reproducibility and cost.

| Repo | Ref | Tree sha | Skills | Errors |
|---|---|---|---|---|
| anthropics/skills | main | `9d2f1ae18723` | 18 | 0 |

Reproduce: `npm run build && node scripts/state-of-skills.mjs anthropics/skills`
