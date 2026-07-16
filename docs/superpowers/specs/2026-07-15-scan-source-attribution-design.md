# Scan Source Attribution + Conversion Funnel — Design

**Date:** 2026-07-15
**Repo:** skillcrossroads (beacon-monorepo)
**Sprint:** Focus lock 2026-07-15 → 2026-07-22; slice #2 of the 4-part demand-generation sequence (readout → **launch conversion** → viral loop → launch assets).
**Depends on:** slice #1 (G0 Demand-Signal Readout, PR #2, branch `feat/g0-demand-readout`). This slice extends slice #1's `@beacon/core/demand` module, so its implementation branches off `feat/g0-demand-readout` and rebases to `main` after PR #2 merges.

## Problem

When Steve posts the launch to a community, nothing tells him whether that post drove scans. Scans record `slug/name/grade/overall/login/scanned_at` but **no source** — a launch-campaign visitor is indistinguishable from organic traffic. And nothing measures whether a scan converts onward (into a badge embed or gallery opt-in — the distribution that compounds). Slice #1 counts external scans; this slice answers **where they came from** and **whether they convert**.

## Goal

1. **Attribute** every scan to a source (campaign `?ref=` tag, else referrer host, else unknown) — one additive nullable column, no new data pipeline.
2. **Measure the server-side funnel**: `source → external scans → scan-to-distribution conversion` (external-scanned repos that also produced a badge serve / gallery opt-in).
3. Surface both in slice #1's terminal readout and owner dashboard panel.

**Non-goals (explicitly deferred):** client-beacon top-of-funnel (landing-view → scan-submitted drop-off) — a later slice only if attribution proves it's needed. No friction/UX changes to the scan form (that was the other branch of slice #2; not chosen).

## Source classification (pure, honest)

`normalizeSource(ref: string | null, referrerHost: string | null): string | null`
- **Campaign tag wins:** if `ref` is present, sanitize (lowercase, keep `[a-z0-9-]`, collapse repeats, cap 32 chars); return it if non-empty (e.g. `reddit`, `hn-launch`).
- **Else referrer host:** if `referrerHost` is present, strip a leading `www.`, lowercase; map a small set of known hosts to short tags (`news.ycombinator.com`→`hn`, `reddit.com`→`reddit`, `twitter.com`/`x.com`→`x`, `github.com`→`github`); otherwise return the bare host.
- **Else `null`** (direct / unknown).
- **Same-origin filtering stays in the caller:** the route passes `referrerHost` only when the `Referer` host differs from the request host, so internal navigation never counts as a source. `normalizeSource` stays pure over its given inputs.

## Components

### 1. Migration — `apps/web/scripts/migrate-scan-source.mjs`
`ALTER TABLE scans ADD COLUMN IF NOT EXISTS source TEXT;` plus `CREATE INDEX IF NOT EXISTS scans_source_idx ON scans (source);`. Mirrors the existing `migrate-badge-serves.mjs` (pg Pool from `DATABASE_URL`, idempotent). Additive and backward-compatible — existing rows keep `source = NULL`. Operator runs it on prod at deploy (documented, like the badge-serves migration).

### 2. Core — `packages/core/src/demand/source.ts` (new, pure)
`normalizeSource(ref, referrerHost)` as specified above. Exported from `@beacon/core`. Pure, fully unit-tested (campaign tag, sanitization, host mapping, bare host, null).

### 3. Core — extend `packages/core/src/demand/metric.ts`
Add to `DemandMetric` (additive — existing fields unchanged):
- `externalScansBySource: Array<{ source: string; count: number }>` — external scans grouped by `coalesce(source, 'unknown')`, ordered by count desc, top 10.
- `reposWithBadgeServe: number` — distinct external-scanned slugs that also appear in `badge_serves` with `from_github = true`.
- `reposWithGalleryOptIn: number` — distinct external-scanned slugs that also appear in `gallery_entries` (id = slug).

New SQL (all reuse the existing `EXTERNAL` predicate + owner param `$1`):
- by-source: `SELECT coalesce(source,'unknown') AS source, count(*)::int AS count FROM scans WHERE <EXTERNAL> GROUP BY 1 ORDER BY 2 DESC LIMIT 10`
- badge conversion: `SELECT count(DISTINCT s.slug)::int AS n FROM scans s JOIN badge_serves b ON b.slug = s.slug AND b.from_github = true WHERE <EXTERNAL over s.login>`
- gallery conversion: `SELECT count(DISTINCT s.slug)::int AS n FROM scans s JOIN gallery_entries g ON g.id = s.slug WHERE <EXTERNAL over s.login>`

(The join queries qualify the predicate with the `s.` alias — the predicate string is the same logic, aliased.)

### 4. Core — extend `packages/core/src/demand/format.ts`
Render, after the existing "Leading indicators" block:
- a "Scans by source" list (`source  count`), and
- a "Conversion" line: `scans→badge  : N/{distinctExternalRepos}` and `scans→gallery: M/{distinctExternalRepos}`.

### 5. Web — attribution wiring
- `lib/scans.ts`: add optional `source?: string` to `ScanRecord`; include it in the pg `INSERT INTO scans (…, source) VALUES (…, $8)` and in the in-memory `record`.
- `lib/record.ts`: add a `source?: string` parameter to `recordScans`, threaded into the `record({ …, ...(source ? { source } : {}) })` call.
- `app/s/[...slug]/route.ts` and `app/api/gallery/opt-in/route.ts`: at the `recordScans(...)` call, compute `const source = normalizeSource(new URL(req.url).searchParams.get("ref"), externalRefererHost(req))` and pass it. `externalRefererHost` is a tiny local helper: parse the `Referer` header host, return it only when it differs from the request host, else `null`.

### 6. Web — dashboard panel
Extend the owner-gated Demand/G0 panel (slice #1) to render `externalScansBySource` and the two conversion counts (with rates over `distinctExternalRepos`). Reuses the existing owner gate and the already-fetched `metric`.

## Data flow

```
scan request (/s/... or gallery opt-in)  ── ?ref= + Referer ─►  normalizeSource ─► source
      └─ recordScans(..., source) ─► scans.source (new column)
Postgres ─► computeDemandMetric (existing + by-source + conversion joins) ─► DemandMetric
      ├─► formatDemandReadout (terminal)      └─► dashboard panel
```

## Contract discipline

`source` is an **additive optional** field on slice #1's `ScanRecord` and `DemandMetric` — no existing caller or query breaks (honors the no-contract-break rule). New `recordScans` param is optional; both call sites updated. Owner exclusion stays single-sourced in `metric.ts` via the same `EXTERNAL` predicate.

## Testing

- `packages/core/test/demand-source.test.ts` — `normalizeSource`: campaign tag precedence, sanitization/cap, host mapping, bare host, null.
- Extend `packages/core/test/demand-metric.test.ts` — add fixtures/handlers for the three new queries; assert by-source grouping and the two conversion counts. Existing per-field assertions remain valid (additive).
- Web: `lib/scans.ts` change covered by any existing scans test + typecheck; the two route wirings verified by typecheck + the deferred live run.
- No `Date.now()`/`new Date()` in core. Vitest `globals: false`, NodeNext `.js` specifiers.

## Risk & rollback

One additive nullable column + index (idempotent migration; run on prod at deploy — the only schema touch, additive so no rollback data risk). All reads are read-only. The attribution wiring is best-effort (recording already swallows errors and never fails a scan). Rollback = revert the commits; the column can stay (harmless) or be dropped separately.

## Claim ladder

On completion: **built** (code + tests green). **live-proven** requires: run `migrate-scan-source.mjs` on prod, deploy, confirm a `?ref=` scan lands with the right `source`, and confirm the readout/panel show by-source + conversion against real data.
