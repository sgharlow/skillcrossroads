# The State of Claude Code Agents & Commands

*An evidence-based audit of 123 public Claude Code artifacts — 87 subagents and 36 slash commands across 10 repositories — graded by **Skill Crossroads** (rubric v1.2), the signpost for Claude Code artifacts. Every figure below comes from this run and is traceable to the pinned git trees in the methodology. Generated 2026-07-13.*

> **Edition disclosure — deterministic only.** No LLM-assisted checks ran in this edition. Every figure is from Skill Crossroads' pure, bit-reproducible deterministic checks. The triggering figures come from the deterministic description-quality checks (TRIGGER-02 description length, TRIGGER-03 invocation cues, TRIGGER-05 invocation-flag consistency) — **not** the LLM triggering judge (TRIGGER-01), which was excluded for cost and reproducibility.

> **Scope.** A curated sample of community subagent and command collections (up to 15 artifacts each, 250 total). Only `subagent` and `command` artifacts are graded — skills, MCP configs, and plugin manifests in the same repos are out of scope for this report. Repos whose layout Skill Crossroads cannot discover (agents at the repo root or in category directories instead of an `agents/` or `commands/` parent dir) are disclosed in the methodology table rather than silently dropped.

## The headline

Across 87 subagents, the average Skill Crossroads score is **89.1/100**. The single most common subagent problem in this run is **tools least-privilege** (SAFETY-02): **85%** don't cleanly pass it (74 of 87).

Across 36 slash commands, the average score is **93.9/100**. The most common command problem is **recommended fields present** (STRUCT-02): **81%** don't cleanly pass it (29 of 36).

**57% of subagents (50 of 87) declare no `tools` list at all** — which means each one silently inherits *every* tool, including unrestricted Bash. Add 16 more granting bare `Bash` and 8 granting a wildcard, and **85%** of the subagent sample is not least-privilege (SAFETY-02).

## Grade distribution

| Grade | Subagents | Share | Commands | Share |
|---|---|---|---|---|
| A | 68 | 78% | 33 | 92% |
| B | 3 | 3% | 3 | 8% |
| C | 0 | 0% | 0 | 0% |
| D | 16 | 18% | 0 | 0% |
| F | 0 | 0% | 0 | 0% |

Average overall: **subagents 89.1/100**, **commands 93.9/100**. Deterministic grades are computed over the evaluated categories with weights renormalized — LLM-only categories (e.g. Verifiability for agents/commands) stay honestly unscored in this edition.

**Read the letter grades honestly.** Most published artifacts clear the deterministic floor — structure, budgets, and safety are table stakes, and letter grades cluster high because of it. The discriminating findings live in the LLM-assisted checks (whether a description will actually trigger, whether constraints and failure modes are stated, whether the instructions contradict themselves, whether anything verifies the work) — and none of them ran in this deterministic edition. A high letter grade here means "won't visibly break"; it is a floor, not an endorsement.

## How 87 subagents do on each check

Share of the 87 subagents that **pass cleanly** (higher is better):

```
STRUCT-01 valid YAML frontmatter              ████████████████░░░░  82%   n=87 (0 warn, 16 fail)
STRUCT-02 recommended fields present          ███████████████░░░░░  76%   n=87 (5 warn, 16 fail)
TOKEN-01 under the line/token budget          ██████████████████░░  91%   n=87 (8 warn, 0 fail)
TOKEN-03 description budget footprint         ████████████████████  98%   n=87 (2 warn, 0 fail)
TOKEN-04 recurring per-invocation cost        ████████████████████  99%   n=87 (1 warn, 0 fail)
CLARITY-03 no ASCII-art / persona filler      ████████████████████  98%   n=87 (1 warn, 1 fail)
SAFETY-01 no hardcoded secrets                ████████████████████ 100%   n=87 (0 warn, 0 fail)
SAFETY-02 tools least-privilege               ███░░░░░░░░░░░░░░░░░  15%   n=87 (66 warn, 8 fail)
SAFETY-03 no destructive auto-invocation      ████████████████░░░░  78%   n=87 (19 warn, 0 fail)
SAFETY-04 no shell-injection in ! blocks      ████████████████████ 100%   n=87 (0 warn, 0 fail)
AGENT-01 declared model is valid              ████████████████████ 100%   n=87 (0 warn, 0 fail)
TRIGGER-02 description long enough to anchor  ██████████████░░░░░░  71%   n=87 (7 warn, 18 fail)
TRIGGER-03 invocation cues in description     ███░░░░░░░░░░░░░░░░░  17%   n=87 (56 warn, 16 fail)
TRIGGER-05 invocation flags consistent        ████████████████████ 100%   n=87 (0 warn, 0 fail)
```

## How 36 slash commands do on each check

Share of the 36 commands that **pass cleanly** (higher is better):

```
STRUCT-01 valid YAML frontmatter              ████████████████████ 100%   n=36 (0 warn, 0 fail)
STRUCT-02 recommended fields present          ████░░░░░░░░░░░░░░░░  19%   n=36 (29 warn, 0 fail)
TOKEN-01 under the line/token budget          ███████████████████░  97%   n=36 (1 warn, 0 fail)
TOKEN-03 description budget footprint         ████████████████████ 100%   n=36 (0 warn, 0 fail)
TOKEN-04 recurring per-invocation cost        ████████████████████ 100%   n=36 (0 warn, 0 fail)
CLARITY-03 no ASCII-art / persona filler      █████████████████░░░  83%   n=36 (4 warn, 2 fail)
SAFETY-01 no hardcoded secrets                ████████████████████ 100%   n=36 (0 warn, 0 fail)
SAFETY-02 tools least-privilege               █████████████████░░░  86%   n=36 (5 warn, 0 fail)
SAFETY-03 no destructive auto-invocation      ███████████████████░  94%   n=36 (2 warn, 0 fail)
SAFETY-04 no shell-injection in ! blocks      ████████████████████ 100%   n=36 (0 warn, 0 fail)
CMD-01 arguments and argument-hint agree      ████████████████░░░░  78%   n=36 (8 warn, 0 fail)
```

## Findings

- **The no-`tools` inherits-everything trap (SAFETY-02).** 50 of 87 subagents (57%) omit the `tools` field. That reads like a safe default but is the opposite: a subagent without a `tools` list inherits the caller's entire toolbox — Bash included — so a delegated worker meant to "just read code" can run arbitrary shell commands. 16 more grant bare `Bash` outright and 8 grant a wildcard.
- **Model declarations are clean (AGENT-01).** 0 of 87 subagents have a typo'd `model:` value — every declared model is a recognized alias (`sonnet`/`opus`/`haiku`/`inherit`) or `claude-*` id. The runtime-failure trap this check exists for did not appear in this sample.
- **Descriptions too thin to trigger delegation (TRIGGER-02/03).** 29% of subagent descriptions (25 of 87) are too short to anchor automatic delegation, and 83% (72 of 87) lack the invocation cues ("use when…", "use PROACTIVELY…") Claude matches on. An agent whose description doesn't say when to use it is an agent that never fires. (Deterministic proxies — the LLM triggering judge did not run in this edition.)
- **`$ARGUMENTS` vs `argument-hint` drift (CMD-01).** 8 of 36 commands (22%) use arguments without declaring `argument-hint` (or declare a hint they never use) — the user gets no signature hint at the prompt, or a misleading one.
- **Hardcoded secrets (SAFETY-01).** 0 of 123 artifacts (0%) tripped the secret scan — the one check this sample passes across the board.

## What this means

**0 of 87 subagents (0%)** and **3 of 36 commands (8%)** pass every deterministic check cleanly.

The most common defects across the sample:

- subagents — tools least-privilege (SAFETY-02): 74 of 87
- subagents — invocation cues in description (TRIGGER-03): 72 of 87
- subagents — description long enough to anchor (TRIGGER-02): 25 of 87
- subagents — recommended fields present (STRUCT-02): 21 of 87
- subagents — no destructive auto-invocation (SAFETY-03): 19 of 87
- commands — recommended fields present (STRUCT-02): 29 of 36
- commands — arguments and argument-hint agree (CMD-01): 8 of 36
- commands — no ASCII-art / persona filler (CLARITY-03): 6 of 36
- commands — tools least-privilege (SAFETY-02): 5 of 36
- commands — no destructive auto-invocation (SAFETY-03): 2 of 36

Each is catchable **before** publishing, with `npx skillcrossroads ./your-repo` — the same engine grades agents, commands, skills, MCP configs, and plugins.

## Methodology & reproducibility

Skill Crossroads' **deterministic checks only** (rubric v1.2, no LLM) were run 2026-07-13 against each repo's git tree at the sha below — the engine's own discovery (`findArtifactFiles`) and grading (`auditAsync`) pipeline, identical to what the hosted scanner runs on these kinds. Deterministic checks are pure, so re-scanning the same tree reproduces these figures exactly. The LLM-assisted checks (TRIGGER-01 triggering judge, VERIFY-04, CLARITY-05, CLARITY-02) were excluded from this edition for cost and reproducibility — triggering figures above are the deterministic TRIGGER-02/03/05 proxies.

Caps: up to 15 artifacts per repo (`BEACON_MAX_PER_REPO`), 250 total (`BEACON_MAX_TOTAL`). Discovery finds `.md` files whose parent directory is `agents/` or `commands/` at any depth; each kind is sampled alphabetically, and when a repo ships both kinds the per-repo cap is split between them so neither crowds the other out of the sample. "Discovered" below is everything in the tree matching that layout; "graded" is the capped sample this report aggregates. A repo where discovery finds nothing is marked "no discoverable agent/command layout".

| Repo | Ref | Tree sha | Agents graded | Commands graded | Discovered (agents+cmds) | Errors | Note |
|---|---|---|---|---|---|---|---|
| [VoltAgent/awesome-claude-code-subagents](https://skillcrossroads.com/s/VoltAgent/awesome-claude-code-subagents) ([source](https://github.com/VoltAgent/awesome-claude-code-subagents)) | main | [`947b44ca0c58`](https://github.com/VoltAgent/awesome-claude-code-subagents/tree/947b44ca0c58d606b084e9cb1a2389335b49278b) | 0 | 0 | 0+0 | 0 | no discoverable agent/command layout |
| [0xfurai/claude-code-subagents](https://skillcrossroads.com/s/0xfurai/claude-code-subagents) ([source](https://github.com/0xfurai/claude-code-subagents)) | main | [`9236d10702cd`](https://github.com/0xfurai/claude-code-subagents/tree/9236d10702cdbba37eaa34515f1e1dbff8452506) | 15 | 0 | 138+0 | 0 |  |
| [rahulvrane/awesome-claude-agents](https://skillcrossroads.com/s/rahulvrane/awesome-claude-agents) ([source](https://github.com/rahulvrane/awesome-claude-agents)) | main | [`513ad8345465`](https://github.com/rahulvrane/awesome-claude-agents/tree/513ad8345465f82898448417a97fff80fc658d0e) | 0 | 0 | 0+0 | 0 | no discoverable agent/command layout |
| [NicholasSpisak/claude-code-subagents](https://skillcrossroads.com/s/NicholasSpisak/claude-code-subagents) ([source](https://github.com/NicholasSpisak/claude-code-subagents)) | main | [`1a16f36820d5`](https://github.com/NicholasSpisak/claude-code-subagents/tree/1a16f36820d5db5516cf188712fcbb10ae63811c) | 14 | 1 | 77+1 | 0 |  |
| [rubenzantingh/claude-code-magento-agents](https://skillcrossroads.com/s/rubenzantingh/claude-code-magento-agents) ([source](https://github.com/rubenzantingh/claude-code-magento-agents)) | master | [`faa1aac58266`](https://github.com/rubenzantingh/claude-code-magento-agents/tree/faa1aac58266e08c8e758dbc0c19be74f5a3fab7) | 0 | 0 | 0+0 | 0 | no discoverable agent/command layout |
| [rshah515/claude-code-subagents](https://skillcrossroads.com/s/rshah515/claude-code-subagents) ([source](https://github.com/rshah515/claude-code-subagents)) | main | [`872758205aa8`](https://github.com/rshah515/claude-code-subagents/tree/872758205aa89f50ddd689db40d5162da278ff25) | 0 | 0 | 0+0 | 0 | no discoverable agent/command layout |
| [sanghun0724/awesome-swift-claude-code-subagents](https://skillcrossroads.com/s/sanghun0724/awesome-swift-claude-code-subagents) ([source](https://github.com/sanghun0724/awesome-swift-claude-code-subagents)) | main | [`e2546ed4de02`](https://github.com/sanghun0724/awesome-swift-claude-code-subagents/tree/e2546ed4de0253398d2e3e0c71b891d643e76a6c) | 0 | 0 | 0+0 | 0 | no discoverable agent/command layout |
| [CoderMageFox/claudecode-codex-subagents](https://skillcrossroads.com/s/CoderMageFox/claudecode-codex-subagents) ([source](https://github.com/CoderMageFox/claudecode-codex-subagents)) | main | [`572b6c64d51f`](https://github.com/CoderMageFox/claudecode-codex-subagents/tree/572b6c64d51f60ada7e89867834f9d77472e9962) | 0 | 2 | 0+2 | 0 |  |
| [iSerter/laravel-claude-agents](https://skillcrossroads.com/s/iSerter/laravel-claude-agents) ([source](https://github.com/iSerter/laravel-claude-agents)) | main | [`8868214ee3fe`](https://github.com/iSerter/laravel-claude-agents/tree/8868214ee3fe0eee4e865dd07dbb9832a05b6ddc) | 10 | 0 | 10+0 | 0 |  |
| [mylee04/claude-code-subagents](https://skillcrossroads.com/s/mylee04/claude-code-subagents) ([source](https://github.com/mylee04/claude-code-subagents)) | main | [`9e1667ad54d6`](https://github.com/mylee04/claude-code-subagents/tree/9e1667ad54d676e66feb9dd6a075cefe84b72e8b) | 15 | 0 | 33+0 | 0 |  |
| [gensecaihq/Claude-Code-Subagents-Collection](https://skillcrossroads.com/s/gensecaihq/Claude-Code-Subagents-Collection) ([source](https://github.com/gensecaihq/Claude-Code-Subagents-Collection)) | main | [`62605aa9a029`](https://github.com/gensecaihq/Claude-Code-Subagents-Collection/tree/62605aa9a0294f2ba7154dda7ffc9a58b9551591) | 0 | 0 | 0+0 | 0 | no discoverable agent/command layout |
| [danielrosehill/Claude-Slash-Commands](https://skillcrossroads.com/s/danielrosehill/Claude-Slash-Commands) ([source](https://github.com/danielrosehill/Claude-Slash-Commands)) | main | [`cf3644b4890d`](https://github.com/danielrosehill/Claude-Slash-Commands/tree/cf3644b4890ddfab833458055cad926b24b10899) | 0 | 15 | 0+401 | 0 |  |
| [Dlaby23/claude-agents-ultimate-collection](https://skillcrossroads.com/s/Dlaby23/claude-agents-ultimate-collection) ([source](https://github.com/Dlaby23/claude-agents-ultimate-collection)) | main | [`410d6e073b8b`](https://github.com/Dlaby23/claude-agents-ultimate-collection/tree/410d6e073b8b4e99fb9ce16b458176e455fafd68) | 15 | 0 | 573+0 | 0 |  |
| [snapper-ai/claude-code-workflows](https://skillcrossroads.com/s/snapper-ai/claude-code-workflows) ([source](https://github.com/snapper-ai/claude-code-workflows)) | main | [`6aab465267a5`](https://github.com/snapper-ai/claude-code-workflows/tree/6aab465267a52fb5ae10579cc13e060f6c1eac9f) | 2 | 4 | 2+4 | 0 |  |
| [wshobson/agents](https://skillcrossroads.com/s/wshobson/agents) ([source](https://github.com/wshobson/agents)) | main | [`2de74ac1c8f6`](https://github.com/wshobson/agents/tree/2de74ac1c8f6669821dcef13153332c3168033c1) | 8 | 7 | 199+106 | 0 |  |
| [wshobson/commands](https://skillcrossroads.com/s/wshobson/commands) ([source](https://github.com/wshobson/commands)) | main | [`27d3e77b1a84`](https://github.com/wshobson/commands/tree/27d3e77b1a844223721f6c983ddf261ac4441b89) | 0 | 0 | 0+0 | 0 | no discoverable agent/command layout |
| [qdhenry/Claude-Command-Suite](https://skillcrossroads.com/s/qdhenry/Claude-Command-Suite) ([source](https://github.com/qdhenry/Claude-Command-Suite)) | main | [`e89b2f0b54f5`](https://github.com/qdhenry/Claude-Command-Suite/tree/e89b2f0b54f536a695ed7ae2e6e75e760b7a849e) | 8 | 7 | 126+209 | 0 |  |

Reproduce: `npm run build && node scripts/state-of-agents.mjs` (default repo set; set `GITHUB_TOKEN` for rate limits) — or pass `owner/repo …` to scan your own.
