# Percentile Badge + One-Click Embed Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the viral coefficient — put the honesty-gated percentile on the README badge (`skill crossroads | A− | ≈top 8%`) and add a one-click Copy button to the scorecard's embed block.

**Architecture:** Two small, independent surfaces in `@beacon/core` (a pure `percentileBadgeText`, an optional third badge segment, a copy button in the HTML renderer) plus a gate in the badge route. No scan/scoring/schema changes.

**Tech Stack:** TypeScript (NodeNext ESM), `@beacon/core`, Next.js route, Vitest.

**Branch:** `feat/percentile-badge` (stacked on `feat/scan-source-attribution`). PR base = slice #2; rebase to `main` after the earlier PRs merge.

## Global Constraints

- **Node** 22.x. **ESM:** `@beacon/core` NodeNext — relative import specifiers end in `.js`.
- **Tests:** Vitest `globals: false` — start with `import { describe, it, expect } from "vitest";`. Focused: `npm test -- <name>`. Full: `npm test`.
- **Determinism:** no `Date.now()`/`new Date()` inside `@beacon/core`.
- **Core rebuild:** after editing core, `npm run build --workspace @beacon/core` before web typecheck/build.
- **Badge honesty gating (binding):** the badge percentile renders ONLY for a single full skill (`scan.skills.length === 1 && !card.partial`) AND when `sampleMatchesRubric()` is true; the `≈` is always kept. Multi-skill/partial/error/`n/a` badges get NO pct.
- **Badge back-compat:** `renderBadge` output MUST be byte-identical to today when `opts.pct` is absent (regression-tested).
- **Inline script safety:** the copy `<script>` contains NO interpolated/untrusted data (XSS-safe); progressive-enhancement (the `<pre>` stays selectable with JS off).
- **Commits:** conventional style; **no `Co-Authored-By: Claude` / `noreply@anthropic` trailer**. Verify each: `git log -1 --format=%B | grep -ciE "co-authored-by: claude|noreply@anthropic"` → `0`.

## Existing code this builds on

- `packages/core/src/render/badge.ts` `renderBadge(card, opts)` — 2-cell SVG (`label` #12203A, `value` = grade color). `BadgeOptions { label?, value? }`. Helpers `textWidth`, `xmlEscape`; `PAD=6`, `H=20`.
- `packages/core/src/percentile.ts` — `publicSkillPercentile(overall, sample?)`, `percentileLabel`, `sampleMatchesRubric(sample?)`, `STATE_OF_SKILLS`. `Scorecard.overall: number`.
- `packages/core/src/index.ts:50` exports `publicSkillPercentile, percentileLabel, STATE_OF_SKILLS, type PercentileSample` — NOT `sampleMatchesRubric` (must add), NOT `percentileBadgeText` (new).
- Badge route `apps/web/app/api/badge/[...slug]/route.ts` `computeBadge`: `scan.skills.length === 1 → card = scan.skills[0].scorecard`; else average; returns `renderBadge(card ?? {grade})`. Imports `{ renderBadge, type Scorecard } from "@beacon/core"`.
- `packages/core/src/render/html.ts` `embedSection` (rendered when `opts.embed` set) has `<pre class="embed-code">${esc(badgeMarkdownLine(opts.embed))}</pre>`; `.embed-code{…}` CSS at ~line 229; `PALETTE` imported.
- Test styles: `test/render-badge.test.ts` (`card(grade)` helper builds a Scorecard, `partial: true`); `test/render-html.test.ts` (`audit(fixture("dangling-ref")).scorecard`, `renderHtml(scorecard, {...})`); `test/percentile.test.ts`.

## File Structure

- Modify `packages/core/src/percentile.ts` (+ `percentileBadgeText`) + `packages/core/src/index.ts` (export it + `sampleMatchesRubric`) + `packages/core/test/percentile.test.ts`.
- Modify `packages/core/src/render/badge.ts` (+ `pct?` third segment) + `packages/core/test/render-badge.test.ts`.
- Modify `apps/web/app/api/badge/[...slug]/route.ts` (gate + pass pct).
- Modify `packages/core/src/render/html.ts` (copy button + script + CSS) + `packages/core/test/render-html.test.ts`.

---

### Task 1: `percentileBadgeText` (pure) + core exports

**Files:**
- Modify: `packages/core/src/percentile.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/percentile.test.ts`

**Interfaces:**
- Produces: `function percentileBadgeText(overall: number, sample?: PercentileSample): string`; and `sampleMatchesRubric` + `percentileBadgeText` exported from `@beacon/core`.

- [ ] **Step 1: Write the failing test (append to percentile.test.ts)**

Add the import (extend the existing percentile import line to include `percentileBadgeText`) and a test:

```ts
import { publicSkillPercentile, percentileBadgeText } from "../src/percentile.js";

describe("percentileBadgeText", () => {
  it("renders ≈top N% as the complement of the beats-percentile, with the honesty ≈", () => {
    const t = percentileBadgeText(90);
    expect(t).toMatch(/^≈top \d+%$/);
    expect(t).toBe(`≈top ${100 - publicSkillPercentile(90)}%`);
  });
  it("is monotonic — a higher score is never a larger top-percent", () => {
    const hi = Number(percentileBadgeText(98).match(/(\d+)/)![1]);
    const lo = Number(percentileBadgeText(55).match(/(\d+)/)![1]);
    expect(hi).toBeLessThanOrEqual(lo);
  });
});
```

(If `percentile.test.ts` already imports `publicSkillPercentile` from that path, just add `percentileBadgeText` to that existing import instead of a duplicate line.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- percentile`
Expected: FAIL — `percentileBadgeText` is not exported.

- [ ] **Step 3: Implement**

In `packages/core/src/percentile.ts`, after `percentileLabel`, add:

```ts
/** Short badge form: "≈top N%" — the complement of the beats-percentile. Same sample + ≈ honesty. */
export function percentileBadgeText(overall: number, sample: PercentileSample = STATE_OF_SKILLS): string {
  return `≈top ${100 - publicSkillPercentile(overall, sample)}%`;
}
```

In `packages/core/src/index.ts`, change the percentile export line to add `sampleMatchesRubric` and `percentileBadgeText`:

```ts
export { publicSkillPercentile, percentileLabel, percentileBadgeText, sampleMatchesRubric, STATE_OF_SKILLS, type PercentileSample } from "./percentile.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- percentile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/percentile.ts packages/core/src/index.ts packages/core/test/percentile.test.ts
git commit -m "feat(viral): percentileBadgeText + export sampleMatchesRubric from core"
```

---

### Task 2: Optional third badge segment

**Files:**
- Modify: `packages/core/src/render/badge.ts`
- Test: `packages/core/test/render-badge.test.ts`

**Interfaces:**
- Produces: `BadgeOptions` gains `pct?: string`; `renderBadge` renders a third cell when `pct` is set, and is byte-identical when it is not.

- [ ] **Step 1: Write the failing test (append to render-badge.test.ts)**

Add a local full-grade card helper and tests:

```ts
function fullCard(grade: string): Scorecard {
  return { rubricVersion: "1.0", overall: 90, grade, categories: [], results: [], partial: false };
}

describe("renderBadge percentile segment", () => {
  it("renders a third segment with the pct text and is wider than the 2-cell badge", () => {
    const base = renderBadge(fullCard("A"));
    const withPct = renderBadge(fullCard("A"), { pct: "≈top 8%" });
    expect(withPct).toContain("≈top 8%");
    expect(withPct).toContain("#1B2A45"); // neutral third-cell fill
    const w0 = Number(base.match(/width="(\d+)"/)![1]);
    const w1 = Number(withPct.match(/width="(\d+)"/)![1]);
    expect(w1).toBeGreaterThan(w0);
  });
  it("is unchanged (no third cell) when pct is omitted", () => {
    const svg = renderBadge(fullCard("A"));
    expect(svg).not.toContain("#1B2A45");
    expect(svg).not.toContain("≈top");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- render-badge`
Expected: FAIL — `pct` not rendered / `#1B2A45` absent.

- [ ] **Step 3: Implement — replace `renderBadge` in `packages/core/src/render/badge.ts`**

Add `pct?: string;` to `BadgeOptions` (with a doc comment), and replace the `renderBadge` body with:

```ts
export function renderBadge(card: Scorecard, opts: BadgeOptions = {}): string {
  const label = opts.label ?? "skill crossroads";
  const value = opts.value ?? (card.partial ? `${card.grade}*` : card.grade);
  const color = gradeHex(card.grade);

  const PAD = 6;
  const H = 20;
  const labelW = Math.round(textWidth(label)) + PAD * 2;
  const valueW = Math.round(textWidth(value)) + PAD * 2;
  const pct = opts.pct;
  const pctW = pct ? Math.round(textWidth(pct)) + PAD * 2 : 0;
  const totalW = labelW + valueW + pctW;
  const labelMid = labelW / 2;
  const valueMid = labelW + valueW / 2;
  const pctMid = labelW + valueW + pctW / 2;

  const el = xmlEscape(label);
  const ev = xmlEscape(value);
  const ep = pct ? xmlEscape(pct) : "";
  const baseAria = card.partial && !opts.value ? `${el}: ${ev} (partial grade — some categories not scored)` : `${el}: ${ev}`;
  const aria = pct ? `${baseAria} · ${ep}` : baseAria;

  const pctRect = pct ? `\n    <rect x="${labelW + valueW}" width="${pctW}" height="${H}" fill="#1B2A45"/>` : "";
  const pctText = pct
    ? `\n    <text x="${pctMid}" y="15" fill="#010101" fill-opacity=".3">${ep}</text>\n    <text x="${pctMid}" y="14">${ep}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${H}" role="img" aria-label="${aria}">
  <title>${aria}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#FFF" stop-opacity=".12"/>
    <stop offset="1" stop-opacity=".12"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="${H}" rx="3" fill="#FFF"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${H}" fill="#12203A"/>
    <rect x="${labelW}" width="${valueW}" height="${H}" fill="${color}"/>${pctRect}
    <rect width="${totalW}" height="${H}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11">
    <text x="${labelMid}" y="15" fill="#010101" fill-opacity=".3">${el}</text>
    <text x="${labelMid}" y="14">${el}</text>
    <text x="${valueMid}" y="15" fill="#010101" fill-opacity=".3">${ev}</text>
    <text x="${valueMid}" y="14" fill="#0B1220" font-weight="bold">${ev}</text>${pctText}
  </g>
</svg>
`;
}
```

(When `pct` is undefined: `pctW=0` ⇒ `totalW` unchanged; `pctRect`/`pctText` are empty strings inserted at existing line ends ⇒ output byte-identical to the prior 2-cell badge.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- render-badge`
Expected: PASS (existing badge tests + the two new ones).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/render/badge.ts packages/core/test/render-badge.test.ts
git commit -m "feat(viral): optional percentile third segment on the badge SVG"
```

---

### Task 3: Gate + attach the percentile in the badge route

**Files:**
- Modify: `apps/web/app/api/badge/[...slug]/route.ts`

**Interfaces:**
- Consumes: `percentileBadgeText`, `sampleMatchesRubric` (Task 1) and the `pct` option (Task 2).

- [ ] **Step 1: Update imports**

Change the `@beacon/core` import in `apps/web/app/api/badge/[...slug]/route.ts` to:

```ts
import { renderBadge, percentileBadgeText, sampleMatchesRubric, type Scorecard } from "@beacon/core";
```

- [ ] **Step 2: Gate + pass pct in `computeBadge`**

In `computeBadge`, add a `pct` local and set it only in the single-full-skill branch, then pass it to `renderBadge`. The branch becomes:

```ts
  let card: Scorecard | null = null;
  let grade = "?";
  let pct: string | undefined;
  try {
    const scan = await scanTarget(target, opts);
    if (scan.skills.length === 1) {
      card = scan.skills[0]!.scorecard;
      grade = card.grade;
      if (!card.partial && sampleMatchesRubric()) pct = percentileBadgeText(card.overall);
    } else if (scan.skills.length > 1) {
      grade = averageGrade(scan);
      card = { grade, partial: scan.skills.some((s) => s.scorecard.partial) } as Scorecard;
    }
  } catch {
    grade = "?";
  }
  if (grade === "?") return { svg: renderBadge({ grade } as Scorecard, { value: "n/a" }), ok: false };
  return { svg: renderBadge(card ?? ({ grade } as Scorecard), pct ? { pct } : {}), ok: true };
```

(Only the `pct` declaration, the one gating line, and the final `renderBadge(..., pct ? { pct } : {})` argument change — everything else in `computeBadge` is unchanged.)

- [ ] **Step 3: Typecheck**

Run: `npm run build --workspace @beacon/core && npm run typecheck --workspace @beacon/web`
Expected: clean (`sampleMatchesRubric`/`percentileBadgeText` resolve from the rebuilt core; `card.overall` is a `number` on a real Scorecard).

- [ ] **Step 4: Run the suite (no regressions)**

Run: `npm test`
Expected: all green — the badge route has no unit test here, but core badge/percentile tests and the rest of the suite must stay green.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/api/badge/[...slug]/route.ts"
git commit -m "feat(viral): show percentile on full single-skill badges (honesty-gated)"
```

---

### Task 4: One-click Copy on the embed block

**Files:**
- Modify: `packages/core/src/render/html.ts`
- Test: `packages/core/test/render-html.test.ts`

**Interfaces:**
- Consumes: the existing `opts.embed` block.

- [ ] **Step 1: Write the failing test (append to render-html.test.ts)**

```ts
  it("renders a one-click Copy button + script only when an embed is provided", () => {
    const { scorecard } = audit(fixture("dangling-ref"));
    const embed = {
      badgeUrl: "https://skillcrossroads.com/api/badge/o/r.svg",
      scorecardUrl: "https://skillcrossroads.com/s/o/r",
    };
    const withEmbed = renderHtml(scorecard, { name: "x", embed });
    expect(withEmbed).toContain('class="copy-btn"');
    expect(withEmbed).toContain("navigator.clipboard");
    expect(withEmbed).toContain("embed-code");
    const noEmbed = renderHtml(scorecard, { name: "x" });
    expect(noEmbed).not.toContain('class="copy-btn"');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- render-html`
Expected: FAIL — `copy-btn` not present.

- [ ] **Step 3: Implement — copy button + script + CSS in `packages/core/src/render/html.ts`**

Replace the `embedSection` assignment with:

```ts
  const embedSection = opts.embed
    ? `<section class="embed">
      <h2>Embed this badge</h2>
      <div class="embed-row">
        <a href="${esc(opts.embed.scorecardUrl)}"><img src="${esc(opts.embed.badgeUrl)}" alt="Skill Crossroads grade ${esc(card.grade)}" height="20"></a>
        <span class="cta-blurb">Always-fresh — it re-scans and updates on its own.</span>
      </div>
      <div class="embed-copy">
        <pre class="embed-code">${esc(badgeMarkdownLine(opts.embed))}</pre>
        <button type="button" class="copy-btn">Copy</button>
      </div>
      <script>
(function(){var b=document.querySelector('.copy-btn'),p=document.querySelector('.embed-code');if(!b||!p||!navigator.clipboard)return;b.addEventListener('click',function(){navigator.clipboard.writeText(p.textContent).then(function(){var o=b.textContent;b.textContent='Copied!';setTimeout(function(){b.textContent=o;},1500);});});})();
</script>
    </section>`
    : "";
```

Then add CSS immediately after the existing `.embed-code{…}` rule:

```ts
.embed-copy{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap}
.embed-copy .embed-code{flex:1 1 auto;margin:0}
.copy-btn{background:${PALETTE.ink3};color:${PALETTE.foam};border:1px solid ${PALETTE.ink3};border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;white-space:nowrap}
.copy-btn:hover{filter:brightness(1.15)}
```

(The script has no interpolated data — XSS-safe. With JS off or no `navigator.clipboard`, the `<pre>` remains selectable — nothing breaks.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- render-html`
Expected: PASS.

- [ ] **Step 5: Typecheck + full suite**

Run: `npm run build --workspace @beacon/core && npm run typecheck && npm test`
Expected: clean, all green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/render/html.ts packages/core/test/render-html.test.ts
git commit -m "feat(viral): one-click Copy button on the scorecard embed block"
```

---

## Final verification

- [ ] Full suite: `npm test` — all green including the new percentile/badge/html tests.
- [ ] Typecheck: `npm run build --workspace @beacon/core && npm run typecheck` — clean.
- [ ] Trailer check on new commits: `git log <base>..HEAD --format=%B | grep -ciE "co-authored-by: claude|noreply@anthropic"` prints `0`.
- [ ] Badge back-compat: a `renderBadge(card)` without `pct` is unchanged (Task 2 regression test proves this).
- [ ] Claim ladder: **built** after tests+typecheck green. **live-proven** (deferred, needs deploy): a real full single-skill badge shows `≈top N%` (a partial one does not), and the scorecard Copy button copies the markdown in a browser.

## Self-Review (author)

- **Spec coverage:** `percentileBadgeText` pure + `≈` (Task 1) ✓; third badge segment, byte-identical without pct (Task 2) ✓; honesty gate — single full skill + `sampleMatchesRubric()` (Task 3) ✓; one-click copy, progressive-enhancement, XSS-safe (Task 4) ✓; no scan/scoring/schema change ✓.
- **Placeholder scan:** none — full code in every step.
- **Type consistency:** `pct?`/`BadgeOptions`, `percentileBadgeText`, `sampleMatchesRubric` used identically across percentile/badge/route/tests. `card.overall` is a `number` (types.ts:200).
- **Export hazard handled:** Task 1 exports both `percentileBadgeText` and `sampleMatchesRubric` from `index.ts` so Task 3's `@beacon/core` import resolves after a core rebuild.
