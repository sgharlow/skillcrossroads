# G0 Demand-Signal Readout — Design

**Date:** 2026-07-15
**Repo:** skillcrossroads (beacon-monorepo)
**Sprint context:** Focus lock 2026-07-15 → 2026-07-22; slice #1 of a 4-part demand-generation sequence (readout → launch conversion → viral loop → launch assets).

## Problem

skillcrossroads already **captures** demand data — `scans`, `badge_serves`, `gallery_entries`, `subscriptions` tables, plus Vercel Analytics — but there is no **readout** that answers the question the ROADMAP's Gate G0 is defined in terms of:

> **G0 pass:** external scans > 0 and growing after launch.
> **G0 pivot threshold:** two launch posts + 4 weeks → **zero external scans** ⇒ stop feature work.

Today "external scans" is not computed anywhere. `lib/scans.ts` `stats()` returns `totalScans`/`distinctSkills`/`byGrade` but does not separate the owner's own dogfooding from genuine external demand. Without that separation the launch gate cannot be evaluated with evidence.

## Goal

Make the G0 gate measurable and machine-checkable:
1. Compute **external** (non-owner) demand from existing tables — no new data collection, no schema change.
2. Evaluate the ROADMAP PASS/PIVOT threshold as a **pure function** (Day-1 acceptance test).
3. Surface it two ways: a terminal report (autonomous, no auth surface) and an owner-gated panel on the existing dashboard.

Non-goals (later slices): changing the funnel, amplifying the badge loop, drafting launch posts.

## Owner-vs-external classification (the crux)

- `OWNER_LOGINS` env var, comma-separated GitHub logins. Initial value: `sgharlow`. Parsed once, lowercased, into a Set.
- A scan row is **owner** if `login` ∈ `OWNER_LOGINS` → excluded from external counts.
- A scan row is **anonymous** if `login IS NULL` → counted as external **but reported on a separate line**, because a logged-out owner and a logged-out stranger are indistinguishable. No silent inflation — the readout always shows `external-attributed` (distinct non-owner logins) separately from `anonymous`.
- **External demand signal** = distinct non-owner logins + distinct externally-scanned repos + anonymous scan volume, trended over time.

## Components

Each unit has one purpose, a defined interface, and is independently testable.

### 1. `apps/web/lib/demand.ts` — authoritative G0 metric (single definition)
Exposes one function `computeDemandMetric(deps, opts): Promise<DemandMetric>` where `deps` provides a query runner (the existing `db.ts` pool in prod; an injected fake in tests) and `opts` carries `ownerLogins: Set<string>`, `launchDate: string | null`, `now: Date`.

`DemandMetric` fields:
- `externalScansTotal` — scans excluding owner logins (incl. anonymous), all-time.
- `externalScansSinceLaunch` — same, `scanned_at >= launchDate`.
- `attributedExternalLogins` — distinct `login` values, excluding owner & null.
- `anonymousScans` — count where `login IS NULL`.
- `distinctExternalRepos` — distinct `slug` from non-owner scans.
- `dailyExternalTrend` — `[{ day, count }]` for the last N days (non-owner scans grouped by `scanned_at::date`).
- `badgeServeTrend` — `[{ day, count }]` from `badge_serves` (viral leading indicator).
- `galleryOptIns` — count from `gallery_entries`.
- `paidSubscriptions` — count of active rows in `subscriptions`.

Owner exclusion is expressed **once** here (parametrized SQL `login NOT IN (...) OR login IS NULL`, with the null case tallied separately). No other module re-derives "external."

### 2. `apps/web/lib/g0-gate.ts` — pure threshold evaluator
`evaluateG0(metric: DemandMetric, ctx: { launchDate: string | null; launchPosts: number; now: Date }): G0Verdict`

`G0Verdict = { status: 'pre-launch' | 'live-signal' | 'pivot-warning' | 'pivot'; reasons: string[] }`

Rules (encoding the ROADMAP):
- `launchDate == null` → `pre-launch`.
- `externalScansSinceLaunch > 0` → `live-signal`.
- `launchPosts >= 2` AND weeks-since-launch ≥ 4 AND `externalScansSinceLaunch == 0` → `pivot`.
- launched but `externalScansSinceLaunch == 0` and not yet at the 4-week/2-post threshold → `pivot-warning` (with weeks remaining in `reasons`).

Pure, deterministic, no I/O. `launchDate`/`launchPosts` come from env (`LAUNCH_DATE`, `LAUNCH_POSTS`) so the gate is configurable without code changes.

### 3. `scripts/demand-readout.mjs` — terminal report (`npm run report:demand`)
Loads env, builds the pg pool from `DATABASE_URL`, calls `computeDemandMetric` + `evaluateG0`, prints a compact status block (verdict + key numbers + trend sparkline-ish counts). Follows the existing `scripts/*.mjs` convention. Read-only. Exits non-zero on `pivot` so it can later gate CI if desired.

### 4. Dashboard panel — extend `apps/web/app/dashboard/page.tsx`
Add an owner-gated "Demand / G0" section reusing `lib/demand.ts` + `lib/g0-gate.ts`. Reuses the page's existing session/owner gate (no new auth). Renders the verdict badge and the same numbers as the script. Server component — data fetched server-side, never exposed to non-owners.

## Data flow

```
Postgres (scans, badge_serves, gallery_entries, subscriptions)
      │  (read-only SQL, owner-excluded once)
      ▼
lib/demand.ts  ──►  DemandMetric
      │
      ├──►  lib/g0-gate.ts  ──►  G0Verdict
      │
      ├──►  scripts/demand-readout.mjs   (terminal)
      └──►  app/dashboard (owner panel)  (UI)
```

## Testing

- `lib/demand.test.ts` — inject a fake query runner returning fixture scan rows; assert owner rows excluded, anonymous tallied separately, distinct repos/logins correct, trend buckets correct. Reuse the `createMemoryScanHistory` fixture style already in `lib/scans.ts`.
- `lib/g0-gate.test.ts` — table-driven: pre-launch, first external scan → live-signal, launched-but-zero within window → pivot-warning, 2 posts + 4 weeks + zero → pivot. Pure function, no mocks.
- No live DB in tests. `typecheck` (existing `tsc --noEmit` path) must pass.

## Risk & rollback

Read-only feature: no schema change, no write path, no new external dependency. The script only reads prod `DATABASE_URL`. The dashboard panel is behind the existing owner gate. Rollback = revert the commit; nothing to migrate.

## Config summary

- `OWNER_LOGINS=sgharlow` (comma-sep, extendable)
- `LAUNCH_DATE=` (ISO date; unset ⇒ pre-launch)
- `LAUNCH_POSTS=0` (count of launch posts made; bumped as Steve launches)

## Claim-ladder note

On completion this slice is **built** (code + tests green). It becomes **live-proven** only after `npm run report:demand` runs against prod `DATABASE_URL` once and the dashboard panel is verified rendering in the deployed app.
