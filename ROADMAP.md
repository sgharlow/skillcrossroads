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
