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

### Sprint 1 — Adoption floor (launch-safe) · **SHIPPED 2026-07-10** (`live-proven`)

> All three items shipped in `skillcrossroads@0.2.0` + the same-day site deploy: config/suppression
> (CLI+Action; SAFETY-* unsuppressible; disclosure on every surface), the ecosystem percentile
> (full-rubric cards only, ≈-labeled, capped at 99%), and the `audit-skill` Skill (grades A 94.3/100
> on the full rubric; CI gates it at A− per PR). 208 tests. Actual effort: well under estimate.
*These three de-risk the launch itself: the first blockers real users hit, and the two cheapest
demand amplifiers. No horizontal breadth.*

| # | Item | Why first | Est. |
|---|------|-----------|------|
| 1 | **Config + suppression** — `.skillcrossroads.json`: disable/ignore a check globally or per-skill (with a required `reason`), set `min-grade`, token-budget overrides; suppressions disclosed on the scorecard ("2 checks suppressed") so grades stay honest | The #1 linter-adoption blocker: one false positive in CI with no escape hatch = uninstall. Every peer tool ships this | 1.5d |
| 2 | **Percentile benchmark** — every scorecard/badge shows "beats N% of the 214 public skills scanned" (computed from the pinned report dataset; regenerated with each report edition) | Turns an opaque number into a shareable comparison; zero new data collection | 1d |
| 3 | **The `audit-skill` Skill** — a Claude Code skill (in-repo `skill/` + gallery-listed) that runs `npx skillcrossroads` on the user's skill and walks them through the fix list | Distribution inside the ecosystem being audited; must itself grade A (dogfood proof) | 1d |

### Sprint 2 — Tagline integrity: agents & commands · **CORE SHIPPED 2026-07-10** (owner override of the G0 gate)

> Items 4–5 `live-proven` in `skillcrossroads@0.3.0`: subagents + slash commands graded end-to-end
> (kind auto-detection from `agents/`/`commands/` paths + `--kind` flag; kind-aware STRUCT-01/02 —
> command frontmatter optional; SAFETY-02 reads `tools` and warns on the agent inherits-every-tool
> trap; new AGENT-01 model-validity and CMD-01 argument-hint checks; skill-only checks scoped out
> for single-file artifacts; batch scans mix kinds with labels). 219 tests. The Action grades
> agents/commands now (it wraps the CLI). **Item 6 remaining:** hosted web scanning of
> agents/commands + the "State of Claude Code Agents" report edition — next session.

### Sprint 3 — Funnel + CI depth · **SHIPPED 2026-07-10** (owner override of the G0 gate)

> Both items `live-proven` in `skillcrossroads@0.4.0` + same-day deploy: **/paste** paste-to-scan
> (zero-JS form → instant scorecard for skills/agents/commands; deterministic-only, 200 KB cap,
> hostile input escape live-verified; linked from the hero, in the sitemap) and **CI depth** —
> CLI `--annotations=<file>` (::warning/::error, file:line-anchored) + `--json=<file>` sidecar;
> the Action emits inline PR annotations and a best-effort "Changes vs base" grade-delta section
> (base-ref worktree scan + dependency-free delta.mjs, silent on base failure). 227 tests.

### Sprint 4 — Moat cadence + MCP decision · **SHIPPED 2026-07-10** (owner override of the G1 gate)

**Item 9 — `live-proven` in `skillcrossroads@0.5.0` as RUBRIC v1.1** (versioned bump, announced
here + README, never silent): TRIGGER-02 (description length bands — the deterministic floor
under the LLM check, weighted 0.5 so TRIGGER-01 dominates when keyed), TRIGGER-03 (explicit
invocation cues: "use when…", quoted user phrases), VERIFY-01 (evals/tests present, skills only —
eval files > prose "## Verify" > nothing). **Consequence: keyless SKILL scans now score all six
categories — no more partial asterisk for skills** (agents/commands stay honestly partial without
a key). Each check is a ready-made evidence post for the content cadence. 227 tests.

**Item 10 — MCP spike verdict: PASS, scoped two-phase.**
- *Statically gradeable today (Phase A, small):* `.mcp.json` config hygiene — inline secrets in
  `env` blocks, unpinned `npx -y` server packages (supply-chain drift), non-TLS `http://` remote
  transports, over-broad filesystem/shell server roots. All deterministic, file:line-citable —
  comparable to skill checks. **PASS.**
- *NOT statically gradeable:* the server's actual craftsmanship (tool descriptions/triggering,
  schema quality) lives behind a runtime `tools/list` — static-only full grading **FAILS**.
  Feasible path (Phase B, one sprint): a consent-gated `--mcp-live` CLI mode that spawns the
  user's configured stdio server, performs the MCP handshake, lists tools, and grades each tool
  description with the existing triggering heuristics + LLM checks.
- **Decision:** tagline keeps "MCP servers" with Phase A+B committed to the backlog; if Phase B
  is not built by the next quarterly review, drop the tagline claim (honesty over aspiration).

### Sprint 5 — Tagline completion · **SHIPPED 2026-07-10** (owner-directed)

> Closes every in-flight commitment, `live-proven` in `skillcrossroads@0.6.0` + deploy:
> **Hosted agents/commands** (Sprint-2 item 6 leftover) — `scanGitHubRepo` now discovers and
> grades `agents/*.md`, `commands/*.md`, and `.mcp.json` in any public repo, so `/s/owner/repo`
> summaries, deep links, and badges cover them (kind-labeled rows). **MCP Phase A** — `.mcp.json`
> config grading: MCP-01 (valid shape), MCP-02 (version-pinned npx servers — supply-chain),
> MCP-03 (TLS on remote transports, localhost exempt) + the secret scan on inline `env` values;
> `mcp` is a whitelist-only kind so frontmatter/prose checks can never mis-fire on a config.
> 232 tests. Remaining honest gaps: the "State of Agents" report edition (content run needing a
> curated repo list — do alongside the launch), MCP Phase B `--mcp-live`, and SAFETY-01
> JSON-assignment secret patterns (`"DB_PASSWORD": "…"`) — noted as a check improvement.

### Sprint 6 — MCP Phase B + engine polish · **SHIPPED 2026-07-10** (owner-directed)

> `live-proven` in `skillcrossroads@0.7.0`: **`--mcp-live`** — explicit-consent CLI mode that
> spawns the user's own stdio servers, completes the MCP handshake, captures `tools/list`, and
> grades it (MCPT-01 reachability, MCPT-02 tool-description triggering floor, MCPT-03 parameter
> docs) — proven in CI against a real stdio fixture server, timeout-bounded, never reachable from
> the hosted site (spawning configured commands server-side would be RCE by design). Polish:
> SAFETY-01 now catches JSON-style `"DB_PASSWORD": "…"` assignments; hosted single-file discovery
> excludes test/fixture trees (explicit deep links still work); fixed a v1.1 regression where
> deterministic scans were labeled "LLM-assisted" (mode now keys on actual LLM check results).
> 239 tests. **The MCP tagline commitment is fully delivered — no quarterly honesty deadline
> outstanding. Everything below this line is demand-gated: no further build without a G0 signal.**

### Sprint A1 — Badge-in-README (`skillcrossroads init`) · **SHIPPED 2026-07-10** (`live-proven`)

> **The one adoption ergonomic worth building pre-launch.** The badge loop depends on authors
> getting the badge *into* their README; until now that was manual copy-paste (fine for one repo)
> or, for scale, out-of-band API scripting (what the maintainer did by hand across the account —
> not a user-facing capability). `init` closes exactly that gap without new infrastructure: a
> local, no-OAuth, no-backend CLI command in the `npx tailwindcss init` idiom. This is **UX polish
> on the existing badge feature, not new horizontal breadth** — so it clears the demand gate that
> everything below this line does not.
>
> `live-proven` in `skillcrossroads@0.8.0`: **`skillcrossroads init [path]`** scans the repo
> (confirms there are gradeable artifacts + shows the grade), resolves the GitHub `owner/repo` from
> `git remote get-url origin` (or `--repo owner/name`), and inserts an always-fresh linked badge
> under the README's first H1 — or creates a minimal README if there is none (`--no-create` opts
> out; `--dry-run` previews). **It never commits** — the user reviews the diff and commits, so the
> tool stays read-only toward the repo except the one README it writes. The badge URL + markdown
> contract now lives in exactly one place (`@beacon/core` `badge-embed.ts`: `badgeUrls`,
> `badgeMarkdown`, `parseGitHubSlug`, `insertBadge`) consumed by the CLI — no third copy of the
> `/api/badge/OWNER/REPO.svg` shape. 273 tests (+34). Live-proven: real remote resolution on this
> repo (10 artifacts, existing badge correctly detected → idempotent no-op) + a real create in a
> temp repo.
>
> **Explicitly NOT built (still demand-gated — see "the typical developer" analysis):** the
> account-wide "connect your GitHub" GitHub App with one-click badge PRs (Tier 3). That is the
> Codecov-style adoption engine and the honest answer to "do all my repos at once," but it is real
> horizontal infrastructure (App, write scopes, repo-picker UI, PR automation). Build it when the
> launch produces a user who asks for it — not before. Mass auto-editing a user's repos is also
> not even desirable; opt-in-per-repo is the right shape, and `init` is the per-repo primitive.

### Sprint A2 — Account self-service · **SHIPPED 2026-07-10** (`live-proven`)

> **Completing the live paid path, not new breadth.** The app had auth + live Stripe billing but
> no account surface — you could subscribe but not cancel, sign in but not sign out, and scans
> weren't tied to you. Shipping "subscribe" without "cancel" is an *incomplete critical path* on a
> paid tier (Stripe + consumer-protection rules expect an easy cancel), categorically different
> from demand-gated features — so this cleared the gate.
>
> `live-proven`: **`/api/billing/portal`** opens the Stripe Customer Portal (cancel / resume /
> update card / invoices) via the stored customer id — no card data ever touches the app; activated
> once on the live account (`apps/web/scripts/activate-stripe-portal.mjs`). **`/api/auth/logout`**
> expires both cookies. **`/account`** shows identity, plan (Free/Pro), Manage-billing/Upgrade,
> Sign out, and **your recent scans** (per-user history: nullable `scans.login` recorded only for
> signed-in scans — anonymous scans stay anonymous; `ScanHistory.mine`, latest-per-repo; prod DB
> migrated + verified before deploy). Nav gains Account; `/pro/success` now links `/account` (its
> portal promise is finally true). 283 tests. **Remaining dogfood:** a real Pro user clicking
> Manage-billing to confirm the live portal opens (customer path, not covered by synthetic tests).
>
> **Still deferred (Tier 3, demand-gated):** self-serve "disconnect GitHub / delete my data".
> **Not building:** a maintainer revenue/subscriber dashboard — the Stripe dashboard is that.

### Findings from the badge-loop dogfood (2026-07-10) — noted, not yet actioned

- **Kind-aware "partial" semantics.** Badging real command-only / agent-only repos surfaced that
  they always show `A*` (partial): Triggering structurally doesn't apply to an explicitly-invoked
  slash command, and eval-based Verifiability is skills-only — so those categories can *never*
  score for that kind, yet the badge marks the grade "incomplete." Consider distinguishing "no
  check *can* apply to this kind" (→ full grade over applicable categories, no asterisk) from "a
  check could run but didn't, e.g. keyless LLM" (→ genuine partial). Same family as the
  MCP/percentile partial nuance. Small, honest-improving; demand-gated with everything else.
- **Repo scan finds `.claude/` artifacts accurately** (7/39 public repos, zero false positives);
  ~2/7 artifact-repos had no README — **addressed by `init` (Sprint A1)**, which creates a minimal
  README when one is missing so the badge loop can seed there too.

## Ranked roadmap v2 (2026-07-10) — from *grading* to *fixing*

> v1 closed the grading surface: four artifact kinds, ~25 checks, CLI + CI + hosted + badge +
> report + live billing, all `live-proven` or better (run `npm test` for the current count).
> The product now tells an author *what's wrong* with file:line receipts. The assessed biggest
> missing value, in rank order: **helping the author make it right** (fix docs, then fix
> suggestions), **plugins** (the one tagline kind still ungraded — and the ecosystem's actual
> distribution unit), and **two trust warts on the badge loop itself** (the `A*` partial
> asterisk on agent/command-only repos; the cold-badge render that can outlast GitHub's camo
> timeout). Ranking = (developer value × demand-loop leverage) ÷ effort, same formula as v1.
>
> **G0 (the launch send, Steve-court) remains the binding constraint** — nothing below creates
> users; it improves what the first users find. Sprints 7+ are nominally demand-gated behind a
> G0 signal; building ahead of it requires the same explicit owner override recorded on
> Sprints 2–6. Estimates are focused Claude-assisted dev-days including tests, deploy, and live
> verification; calendar assumes ≈1 sprint per week at evenings/weekends pace (the demonstrated
> all-day pace has landed a sprint per day).

### Sprint 7 — Fix-it floor + badge trust (launch-safe polish) · est. ~4 dev-days · 1 week

*Same class as Sprint 1/A1: not horizontal breadth — it upgrades the experience every first
user hits and repairs known warts on the core loop.*

| # | Item | Why now | Est. |
|---|------|---------|------|
| 11 | **Check reference docs** — a `/docs/checks/<ID>` page per check (what it checks, why it matters, how to fix, a good/bad example), generated from metadata declared **in each check module** (one authoritative definition, no second copy); every finding on the scorecard / markdown / annotations links its rule page | The first question after any grade is "how do I fix it" — ESLint-style rule pages are the proven shape. Also the only marketing surface that is simultaneously product: ~25 SEO landing pages from content that already exists in the checks | 2d |
| 12 | **Kind-aware partial semantics** — distinguish "no check *can* apply to this kind" (full grade over applicable categories, **no asterisk**) from "a check could run but didn't (keyless LLM)" (true partial) | Command/agent-only repos badge `A*` forever; "partial" reads as *incomplete work* on repos that scored everything applicable — a standing trust wart logged in the 2026-07-10 badge dogfood | 1d |
| 13 | **Badge cold-start fix** — serve the last-known SVG instantly from the DB (stale-while-revalidate) and refresh in the background | Cold render ≈5.6 s vs GitHub camo's ≈4 s timeout: embedded badges intermittently break at cache expiry. The badge is the growth loop; it must never flicker | 1d |

### Sprint 8 — Plugins: the last tagline kind · est. ~4.5 dev-days · 1 week

| # | Item | Why now | Est. |
|---|------|---------|------|
| 14 | **Plugin grading** — `plugin.json` / marketplace-manifest validity (STRUCT-06 from the v1 catalog), declared-component resolution, and a **roll-up scorecard** aggregating the contained skills/agents/commands/MCP grades; hosted + CLI + badge | The tagline has claimed plugins since day one (same integrity logic that drove Sprints 2/5); plugins are how the ecosystem actually distributes (425+ in one marketplace), and a plugin audit is mostly composition of kinds already graded | 3d |
| 15 | **Hooks safety sweep** — hooks (in plugins and `.claude/settings.json`) run arbitrary shell on events; SAFETY checks for injection surface, destructive commands, inline secrets | The riskiest artifact surface nobody grades — pure differentiation for the evidence-cited safety brand | 1d |
| 16 | **Ship Skill Crossroads as a plugin** (packaging the existing `audit-skill` + a command), self-graded via item 14 | Distribution inside the marketplaces being audited; dogfoods the new kind | 0.5d |

### Sprint 9 — `--suggest`: close the loop from graded to fixed · est. ~3 dev-days · 1 week

| # | Item | Why now | Est. |
|---|------|---------|------|
| 17 | **LLM fix suggestions** — CLI `--suggest` (BYOK) + a Pro hosted "Suggest fixes": a rewritten description / frontmatter patch / token-trim plan per failing check, presented as a reviewable diff; **never auto-applies**; content-hash cached like the other LLM checks | The audit's endgame — the fastest path from C to A. Its v1 precondition (suppression shipped first) is met; sequenced after rule docs so suggestions can cite them | 2.5d |
| 18 | **CLI remote scan** — `skillcrossroads owner/repo` (reuses `scanGitHubRepo`) so "check it before you install it" works in the terminal | The consumer-side use case with near-zero marginal cost; rounds out the CLI | 0.5d |

### Sprint 10 — Moat cadence: rubric v1.2 + State of Agents · est. ~3 dev-days · 1 week

| # | Item | Why now | Est. |
|---|------|---------|------|
| 19 | **Check batch from the v1 catalog remainder** — TRIGGER-05 invocation-flag consistency (D), CLARITY-02 internal-contradiction drift (L), TOKEN-04 recurring $-cost estimate (D), SAFETY-05 MCP input-validation statics; shipped as **rubric v1.2** (versioned, announced, never silent) | The "one new check every 1–2 weeks" cadence *is* the moat, and each check is a ready-made content post | 2d |
| 20 | **"State of Claude Code Agents & Commands" report edition** — curated repo list through the existing report pipeline | The data-report loop is the proven no-video marketing engine; nobody has published ecosystem data on agents. Do alongside (or as fuel for) the launch | 1d |

### Deferred (build only on explicit demand evidence)
- **"Agentic Patterns" Pro rule pack** (Build Bible C.1) — **blocked on the 12 anti-pattern
  source docs (Steve-court)**; once provided, ~1 sprint and the first differentiated Pro content
- **Watch & alerts** — grade-regression email for repos you follow (Pro); first user asking for
  monitoring triggers it (email deliverability treated as day-1 infra when built)
- **Public JSON API** for scores — first integration request triggers it
- **SARIF output** → GitHub code-scanning tab — first enterprise-ish request triggers it
- **Team tier build-out** (org rules, seats, shared dashboard) — first real Team inquiry triggers it
- **GitHub App / one-click badge PRs (Tier 3)** — first user asking "do all my repos" triggers it
- **agentskills.io cross-tool breadth** — grade the open Agent Skills standard beyond Claude
  Code; real TAM expansion but horizontal breadth until demand exists
- **Marketplace grade-listing partnerships** (grades shown in community marketplace indexes) —
  BD/outreach, Steve-court, post-launch

### Rejected (anti-bloat, with reasons)
- **VS Code extension** — a second surface to maintain; the CLI + `audit-skill` Skill cover the workflow
- **GitLab/Bitbucket CI** — zero demand signal; GitHub is where the ecosystem lives
- **Custom rubric weights** — comparability across the ecosystem *is* the product; configurable
  weights fork the meaning of a grade
- **Web user accounts/profiles** — no users to profile; OAuth exists solely to gate Pro
- **Marketplace/site redesigns** — the funnel converts or it doesn't; measure first
- **Skill scaffolder (`skillcrossroads new`)** — Anthropic's `skill-creator` owns creation; we
  own the grade. Competing with the platform vendor on authoring is a losing lane
- **Non-consent public directory of scanned repos** — the opt-in gallery is the right shape;
  publicizing grades of repos whose authors never asked is hostile marketing
- **Auto-apply fixes** — `--suggest` proposes, the human applies; the tool never edits a repo
  beyond `init`'s reviewed README insert

## Post-launch branch plan
- **Win** (G0 passes): proceed down the v2 ranking — Sprint 7 → 8 → 9 → 10, re-ranked against
  what the first real users actually ask for.
- **Flat** (some readers, no scans): one positioning iteration + a second channel post; no code
  beyond Sprint 7's trust fixes until a scan happens.
- **Zombie** (G0 fail threshold hit): stop feature work; site stays up (hosting ≈ $0, monitoring
  in place), npm stays published; quarterly re-review. No teardown needed — but no further build.
