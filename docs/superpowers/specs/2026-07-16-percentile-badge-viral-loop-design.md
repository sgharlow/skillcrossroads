# Percentile Badge + One-Click Embed Copy (Viral Loop) — Design

**Date:** 2026-07-16
**Repo:** skillcrossroads (beacon-monorepo)
**Sprint:** Focus lock 2026-07-15 → 2026-07-22; slice #3 of the 4-part demand-generation sequence (readout → launch conversion → **viral loop** → launch assets).
**Depends on / branch:** stacked on slice #2 (`feat/scan-source-attribution`). Touches badge/percentile/html only (not the demand module), so conflict risk with #1/#2 is low. Rebase to `main` after the earlier PRs merge.

## Problem

The viral loop is already closed — badge in a README → click → scorecard → "Scan your own skill →" → embed a badge → repeat. But the loop's two friction points cap K (the viral coefficient):
1. The README **badge shows only the grade** (`skill crossroads | A−`). The percentile ("beats ≈N%") is computed and shown on the scorecard, but the badge — the artifact actually seen by other developers in READMEs — carries no brag-worthy signal, so it under-pulls clicks and under-motivates embeds.
2. **Embedding requires manual selection** of the markdown `<pre>` block — friction that costs embed-rate.

## Goal

Raise K with two small, honest changes:
1. Put the percentile on the badge (`skill crossroads | A− | ≈top 8%`), honesty-gated.
2. One-click "Copy" on the scorecard's embed block.

**Non-goals:** no change to scan/scoring logic, the percentile sample, or the badge/scorecard URL contract. No new data or schema.

## Honesty gating (binding — reuses existing percentile rules)

The badge percentile renders **only** when all hold (else the badge is exactly as today):
- The scan is a **single skill** (`scan.skills.length === 1`) — percentile is per-skill; multi-skill repo-average badges get none.
- The grade is **full, not partial** (`!card.partial`) — matches the scorecard rule that percentile shows only for full grades.
- `sampleMatchesRubric()` is true — the comparability rule: never rank a live score against a stale-rubric sample (this is the bug that once showed "≈99%").
- The `≈` prefix is always kept (never present the estimate as exact).

## Components

### 1. `packages/core/src/percentile.ts` — short badge string (pure)
Add `percentileBadgeText(overall: number, sample?: PercentileSample): string` → `` `≈top ${100 - publicSkillPercentile(overall, sample)}%` `` (e.g. `≈top 8%`). Reuses the existing `publicSkillPercentile`; same sample, same `≈` honesty.

### 2. `packages/core/src/render/badge.ts` — optional third segment
Add `pct?: string` to `BadgeOptions`. When set, render a **third cell** after the grade cell (neutral fill `#1B2A45`, white text), extending `totalW` by the pct cell width (via the existing `textWidth` heuristic + `PAD`). When absent, output is **byte-identical to today** (regression-tested). The `aria`/`title` gains the pct only when present. The grade cell keeps its grade color and position.

### 3. Badge route — `apps/web/app/api/badge/[...slug]/route.ts`
In `computeBadge`, in the `scan.skills.length === 1` branch, compute `pct = (!card.partial && sampleMatchesRubric()) ? percentileBadgeText(card.overall) : undefined`, and pass `renderBadge(card, pct ? { pct } : {})`. The multi-skill, partial, error, `n/a`, and placeholder branches are unchanged. This changes the cached SVG value — it regenerates on next serve (no schema change; badge_cache/serves untouched).

### 4. `packages/core/src/render/html.ts` — one-click copy
In the `embedSection` (rendered only when `opts.embed` is set), wrap the existing `<pre class="embed-code">` with a Copy `<button>` and a small **guarded inline `<script>`** that copies the `.embed-code` text to the clipboard and flips the button to "Copied!" for ~1.5s. Progressive enhancement: with JS off (or no `navigator.clipboard`), the `<pre>` stays manually selectable — nothing breaks. The script contains **no interpolated/untrusted data** (XSS-safe). Add minimal CSS for the button reusing the existing embed palette.

## Data flow

```
badge request (/api/badge/owner/repo.svg)
  → scanTarget → single full skill? + sampleMatchesRubric()
     → percentileBadgeText(card.overall) → renderBadge(card, { pct }) → 3-segment SVG (cached)
scorecard (/s/owner/repo)  → renderHtml(..., embed) → "Embed this badge" + Copy button + inline script
```

## Testing

- `packages/core/test/percentile.test.ts` — `percentileBadgeText`: format `^≈top \d+%$`; complement relationship to `publicSkillPercentile`; monotonic (higher overall ⇒ not-larger top%).
- `packages/core/test/render-badge.test.ts` — with `pct`: SVG contains the pct text, a third `<rect>`, and a wider `totalW`; **without `pct`: output unchanged** (snapshot/known-string regression). `aria` includes pct only when set.
- `packages/core/test/render-html.test.ts` — embed set ⇒ output contains `class="copy-btn"` + the inline script + the `.embed-code` pre; embed unset ⇒ no copy button. No untrusted data in the script.
- Badge-route gating: verified by typecheck + the deferred live check (a full single-skill badge shows `≈top N%`; a partial/keyless one does not).
- Constraints: no `Date.now()`/`new Date()` in core; NodeNext `.js` specifiers; vitest `globals: false`.

## Risk & rollback

- **SVG width math** for the third cell is the one fiddly part — the render-badge tests assert the structure and that the no-pct path is unchanged. A wrong width renders an ugly but non-breaking badge.
- **Badge propagation:** existing README badges update to the 3-segment form on GitHub-camo's next fetch — additive, low-risk, and only for full single-skill badges.
- **Inline copy script:** progressive-enhancement + XSS-safe; no CSP is set on the scorecard route (verified), so it runs, and if it ever didn't, the pre remains selectable.
- Rollback = revert the commits; no data/schema to migrate.

## Claim ladder

On completion: **built** (code + tests green, typecheck clean). **live-proven** requires: deploy, then confirm a real full single-skill badge renders `≈top N%` (and a partial one does not), and the scorecard Copy button copies the markdown in a browser.
