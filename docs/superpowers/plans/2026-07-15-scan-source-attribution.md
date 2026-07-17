# Scan Source Attribution + Conversion Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attribute every scan to a source (campaign `?ref=` / referrer / unknown) and measure the server-side conversion funnel (source → external scans → scan-to-distribution), surfaced in the slice-#1 readout and dashboard panel.

**Architecture:** Extends slice #1's `@beacon/core/demand` module. One additive nullable column `scans.source` (idempotent migration). A pure `normalizeSource` classifier in core. `computeDemandMetric` gains a by-source breakdown + two conversion joins (all additive to `DemandMetric`). Attribution is wired at the two scan-recording call sites via a `source?` parameter threaded through `recordScans` → `scanHistory.record`.

**Tech Stack:** TypeScript (NodeNext ESM), `@beacon/core`, `pg`, Next.js App Router, Vitest.

**Branch:** Implement on `feat/scan-source-attribution` (already branched off slice #1's `feat/g0-demand-readout`, which carries the demand module). Rebase to `main` after slice #1 PR #2 merges.

## Global Constraints

- **Node:** 22.x.
- **ESM specifiers:** `@beacon/core` NodeNext ESM — relative import specifiers end in `.js`.
- **Tests:** Vitest `globals: false` — test files start with `import { describe, it, expect } from "vitest";`. Run focused: `npm test -- <name>`. Full: `npm test` (root).
- **Determinism:** no `Date.now()`/`new Date()` inside `@beacon/core`.
- **Core rebuild:** after editing core, `npm run build --workspace @beacon/core` before web typecheck/build or running scripts.
- **Owner exclusion** stays single-sourced in `metric.ts` (the `EXTERNAL` predicate); owner logins only from `OWNER_LOGINS` env.
- **Schema:** additive ONLY — `scans.source` is nullable; migration is idempotent (`ADD COLUMN IF NOT EXISTS`). No changes to existing columns. No breaking changes to the slice-#1 `ScanRecord`/`DemandMetric` contract — new fields are additive/optional.
- **Commits:** conventional style; **no `Co-Authored-By: Claude` / `noreply@anthropic` trailer**. Verify each: `git log -1 --format=%B | grep -ciE "co-authored-by: claude|noreply@anthropic"` → `0`.

## Existing code this plan builds on (do not re-derive)

- `scans` columns: `slug, name, grade, overall, rubric_version, category_scores, login (NULL=anon), scanned_at`. INSERT in `apps/web/lib/scans.ts` `createPgScanHistory.record`: `INSERT INTO scans (slug, name, grade, overall, rubric_version, category_scores, login) VALUES ($1,$2,$3,$4,$5,$6,$7)`.
- `badge_serves(id, slug, from_github boolean, served_at)`; `gallery_entries(id = owner/repo/path, …)`.
- `apps/web/lib/record.ts` `recordScans(owner, repo, skills, login?)` → `scanHistory.record({ slug, name, grade, overall, rubricVersion, categoryScores, login? })`.
- Call sites: `app/s/[...slug]/route.ts:109` and `app/api/gallery/opt-in/route.ts:58`, both `after(() => recordScans(target.owner, target.repo, scan.skills, viewer))`, both have `req`.
- Slice #1 `metric.ts`: `const EXTERNAL = "(login IS NULL OR lower(login) <> ALL($1::text[]))";`, `scalar(text, params)` helper reads `rows[0]?.n`, `computeDemandMetric(db, opts)` returns `DemandMetric`.
- `DemandMetric` literal fixtures exist in `packages/core/test/demand-g0-gate.test.ts` (`base`) and `packages/core/test/demand-format.test.ts` (`metric`) — adding interface fields breaks their compilation until updated.

## File Structure

- Create `apps/web/scripts/migrate-scan-source.mjs`.
- Create `packages/core/src/demand/source.ts` + `packages/core/test/demand-source.test.ts`.
- Modify `packages/core/src/demand/metric.ts` (new fields + queries) + `packages/core/test/demand-metric.test.ts` (new handlers + assertions) + fix the two DemandMetric literal fixtures.
- Modify `packages/core/src/demand/format.ts` (render new fields) + `packages/core/test/demand-format.test.ts` (fixture + assertions).
- Modify `packages/core/src/index.ts` (export `normalizeSource` + `SourceCount`).
- Modify `apps/web/lib/scans.ts` (source in `ScanRecord` + both record impls).
- Modify `apps/web/lib/record.ts` (`source?` param).
- Modify `apps/web/app/s/[...slug]/route.ts` and `apps/web/app/api/gallery/opt-in/route.ts` (extract + pass source; local `externalRefererHost` helper).
- Modify `apps/web/app/dashboard/page.tsx` (render by-source + conversion).

---

### Task 1: Additive migration for `scans.source`

**Files:**
- Create: `apps/web/scripts/migrate-scan-source.mjs`

**Interfaces:**
- Produces: an idempotent migration script adding `scans.source TEXT` + an index.

- [ ] **Step 1: Write the migration script**

```js
// apps/web/scripts/migrate-scan-source.mjs
#!/usr/bin/env node
// Additive: add a nullable `source` column to scans for launch attribution. Idempotent.
// Usage (from apps/web): DATABASE_URL=... node scripts/migrate-scan-source.mjs
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(2);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: local ? false : { rejectUnauthorized: false },
  max: 2,
});
try {
  await pool.query(`ALTER TABLE scans ADD COLUMN IF NOT EXISTS source TEXT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS scans_source_idx ON scans (source)`);
  const col = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='scans' AND column_name='source'`,
  );
  console.log(col.rowCount === 1 ? "scans.source present ✓" : "ERROR: scans.source missing");
  process.exitCode = col.rowCount === 1 ? 0 : 1;
} finally {
  await pool.end();
}
```

- [ ] **Step 2: Verify it parses and fails closed without a DB**

Run (from `apps/web`): `node --check scripts/migrate-scan-source.mjs` → exits 0 (valid syntax).
Run (from `apps/web`, no DATABASE_URL): `node scripts/migrate-scan-source.mjs` → prints "DATABASE_URL is not set", exit 2.
(The live migration against prod is a deferred operator step — do not attempt without `DATABASE_URL`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/scripts/migrate-scan-source.mjs
git commit -m "feat(demand): idempotent migration adding scans.source column"
```

---

### Task 2: Pure source classifier

**Files:**
- Create: `packages/core/src/demand/source.ts`
- Test: `packages/core/test/demand-source.test.ts`
- Modify: `packages/core/src/index.ts` (export)

**Interfaces:**
- Produces: `function normalizeSource(ref: string | null, referrerHost: string | null): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/demand-source.test.ts
import { describe, it, expect } from "vitest";
import { normalizeSource } from "../src/demand/source.js";

describe("normalizeSource", () => {
  it("prefers a campaign ref, sanitized and lowercased", () => {
    expect(normalizeSource("Reddit", null)).toBe("reddit");
    expect(normalizeSource("HN Launch!!", null)).toBe("hn-launch");
  });
  it("caps ref length at 32 chars", () => {
    expect(normalizeSource("a".repeat(50), null)).toBe("a".repeat(32));
  });
  it("falls back to a mapped referrer host when no ref", () => {
    expect(normalizeSource(null, "news.ycombinator.com")).toBe("hn");
    expect(normalizeSource(null, "www.reddit.com")).toBe("reddit");
    expect(normalizeSource(null, "x.com")).toBe("x");
  });
  it("returns the bare host for an unmapped referrer", () => {
    expect(normalizeSource(null, "www.example.com")).toBe("example.com");
  });
  it("returns null when neither ref nor referrer is usable", () => {
    expect(normalizeSource(null, null)).toBeNull();
    expect(normalizeSource("   ", null)).toBeNull();
    expect(normalizeSource("!!!", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- demand-source`
Expected: FAIL — cannot find module `../src/demand/source.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/demand/source.ts

const HOST_TAGS: Record<string, string> = {
  "news.ycombinator.com": "hn",
  "reddit.com": "reddit",
  "twitter.com": "x",
  "x.com": "x",
  "github.com": "github",
};

/** Normalize a campaign ref (preferred) or referrer host into a short source tag; null if neither. */
export function normalizeSource(ref: string | null, referrerHost: string | null): string | null {
  if (ref) {
    const tag = ref
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    if (tag) return tag;
  }
  if (referrerHost) {
    const host = referrerHost.trim().toLowerCase().replace(/^www\./, "");
    if (host) return HOST_TAGS[host] ?? host;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- demand-source`
Expected: PASS (5 tests).

- [ ] **Step 5: Export from core**

In `packages/core/src/index.ts`, add near the other demand exports:

```ts
export { normalizeSource } from "./demand/source.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/demand/source.ts packages/core/test/demand-source.test.ts packages/core/src/index.ts
git commit -m "feat(demand): pure normalizeSource classifier (ref > referrer > null)"
```

---

### Task 3: Extend the demand metric with by-source + conversion

**Files:**
- Modify: `packages/core/src/demand/metric.ts`
- Modify: `packages/core/test/demand-metric.test.ts`
- Modify: `packages/core/test/demand-g0-gate.test.ts` (fixture compile-fix)
- Modify: `packages/core/test/demand-format.test.ts` (fixture compile-fix)

**Interfaces:**
- Produces (additive to `DemandMetric`): `interface SourceCount { source: string; count: number }`; new fields `externalScansBySource: SourceCount[]`, `reposWithBadgeServe: number`, `reposWithGalleryOptIn: number`.

- [ ] **Step 1: Write the failing test (extend the metric test)**

In `packages/core/test/demand-metric.test.ts`: (a) in BOTH existing `fakeDb([...])` handler lists, append these three handlers so the new queries the implementation now issues are satisfied (place them BEFORE any broad matcher; they are distinctive):

```ts
      [/coalesce\(source, 'unknown'\)/s, [{ source: "reddit", count: 5 }, { source: "unknown", count: 2 }]],
      [/JOIN badge_serves b ON/s, [{ n: 3 }]],
      [/JOIN gallery_entries g ON/s, [{ n: 1 }]],
```

(b) Add a new assertion test inside the `describe`:

```ts
  it("computes external scans by source and scan-to-distribution conversion", async () => {
    const db = fakeDb([
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL.*scanned_at >= \$2/s, [{ n: 3 }]],
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL/s, [{ n: 7 }]],
      [/count\(DISTINCT lower\(login\)\)::int AS n FROM scans/s, [{ n: 2 }]],
      [/count\(\*\)::int AS n FROM scans WHERE login IS NULL/s, [{ n: 4 }]],
      [/count\(DISTINCT slug\)::int AS n FROM scans WHERE \(login IS NULL/s, [{ n: 5 }]],
      [/GROUP BY 1 ORDER BY 1/s, [{ day: "2026-07-15", count: 2 }]],
      [/FROM badge_serves WHERE served_at/s, [{ n: 9 }]],
      [/FROM badge_serves\s+WHERE from_github = true/s, [{ n: 6 }]],
      [/FROM gallery_entries$/s, [{ n: 8 }]],
      [/FROM subscriptions WHERE pro = true/s, [{ n: 1 }]],
      [/coalesce\(source, 'unknown'\)/s, [{ source: "reddit", count: 5 }, { source: "unknown", count: 2 }]],
      [/JOIN badge_serves b ON/s, [{ n: 3 }]],
      [/JOIN gallery_entries g ON/s, [{ n: 1 }]],
    ]);
    const m = await computeDemandMetric(db, { ownerLogins: new Set(["sgharlow"]), launchDate: "2026-07-13", trendDays: 30 });
    expect(m.externalScansBySource).toEqual([
      { source: "reddit", count: 5 },
      { source: "unknown", count: 2 },
    ]);
    expect(m.reposWithBadgeServe).toBe(3);
    expect(m.reposWithGalleryOptIn).toBe(1);
  });
```

Note: the existing `FROM gallery_entries` handler for `galleryOptIns` must not accidentally match the new JOIN query. Update the existing galleryOptIns handler regex in all three tests from `/FROM gallery_entries/s` to `/FROM gallery_entries$/s` (anchored — the opt-in count query ends at `gallery_entries`, while the JOIN query continues with ` g ON`). The `JOIN gallery_entries g ON` handler matches the conversion query.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- demand-metric`
Expected: FAIL — `m.externalScansBySource` is undefined / property missing (new test), and possibly "unexpected query" until the implementation issues the new queries.

- [ ] **Step 3: Implement — add the fields, queries, and SourceCount type**

In `packages/core/src/demand/metric.ts`, add the type and interface fields:

```ts
export interface SourceCount {
  source: string;
  count: number;
}
```

Add to the `DemandMetric` interface (after `paidSubscriptions`):

```ts
  externalScansBySource: SourceCount[];
  reposWithBadgeServe: number;
  reposWithGalleryOptIn: number;
```

In `computeDemandMetric`, after `paidSubscriptions` is computed and before the `return`, add:

```ts
  const externalScansBySource = (
    await db.query(
      `SELECT coalesce(source, 'unknown') AS source, count(*)::int AS count
       FROM scans WHERE ${EXTERNAL}
       GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT 10`,
      [owners],
    )
  ).rows as SourceCount[];
  const reposWithBadgeServe = await scalar(
    `SELECT count(DISTINCT s.slug)::int AS n
     FROM scans s JOIN badge_serves b ON b.slug = s.slug AND b.from_github = true
     WHERE (s.login IS NULL OR lower(s.login) <> ALL($1::text[]))`,
    [owners],
  );
  const reposWithGalleryOptIn = await scalar(
    `SELECT count(DISTINCT s.slug)::int AS n
     FROM scans s JOIN gallery_entries g ON g.id = s.slug
     WHERE (s.login IS NULL OR lower(s.login) <> ALL($1::text[]))`,
    [owners],
  );
```

Add the three to the returned object:

```ts
    externalScansBySource,
    reposWithBadgeServe,
    reposWithGalleryOptIn,
```

- [ ] **Step 4: Fix the two DemandMetric literal fixtures (compile)**

In `packages/core/test/demand-g0-gate.test.ts`, add to the `base` literal:

```ts
  externalScansBySource: [], reposWithBadgeServe: 0, reposWithGalleryOptIn: 0,
```

In `packages/core/test/demand-format.test.ts`, add to the `metric` literal:

```ts
  externalScansBySource: [{ source: "reddit", count: 5 }], reposWithBadgeServe: 2, reposWithGalleryOptIn: 1,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- demand-metric demand-g0-gate demand-format`
Expected: PASS (metric now includes the by-source test; gate + format compile with the new fields).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/demand/metric.ts packages/core/test/demand-metric.test.ts packages/core/test/demand-g0-gate.test.ts packages/core/test/demand-format.test.ts
git commit -m "feat(demand): by-source breakdown + scan-to-distribution conversion in the metric"
```

---

### Task 4: Render source + conversion in the terminal formatter

**Files:**
- Modify: `packages/core/src/demand/format.ts`
- Modify: `packages/core/test/demand-format.test.ts`

**Interfaces:**
- Consumes: the new `DemandMetric` fields from Task 3.

- [ ] **Step 1: Write the failing test (extend format test)**

Add assertions to the existing `it("renders the verdict, its reasons, and the key numbers", ...)` in `packages/core/test/demand-format.test.ts` (the `metric` fixture already has the new fields from Task 3 Step 4):

```ts
    expect(out).toContain("Scans by source:");
    expect(out).toContain("reddit");
    expect(out).toContain("badge embedded (GitHub) : 2/5");
    expect(out).toContain("gallery opt-in          : 1/5");
```

(`distinctExternalRepos` in the fixture is 5, so conversion renders as `2/5` and `1/5`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- demand-format`
Expected: FAIL — output does not yet contain "Scans by source:" / the conversion lines.

- [ ] **Step 3: Implement — extend the formatter**

In `packages/core/src/demand/format.ts`, after the existing "Leading indicators" block (the `paidSubscriptions` line) and before the daily-trend block, add:

```ts
  if (metric.externalScansBySource.length) {
    L.push("");
    L.push("Scans by source:");
    for (const s of metric.externalScansBySource) L.push(`  ${s.source.padEnd(24)} ${s.count}`);
  }
  L.push("");
  L.push("Conversion (external-scanned repos → distribution):");
  L.push(`  badge embedded (GitHub) : ${metric.reposWithBadgeServe}/${metric.distinctExternalRepos}`);
  L.push(`  gallery opt-in          : ${metric.reposWithGalleryOptIn}/${metric.distinctExternalRepos}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- demand-format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/demand/format.ts packages/core/test/demand-format.test.ts
git commit -m "feat(demand): render scans-by-source + conversion in the terminal readout"
```

---

### Task 5: Wire source attribution into scan recording

**Files:**
- Modify: `apps/web/lib/scans.ts`
- Modify: `apps/web/lib/record.ts`
- Modify: `apps/web/app/s/[...slug]/route.ts`
- Modify: `apps/web/app/api/gallery/opt-in/route.ts`

**Interfaces:**
- Consumes: `normalizeSource` from `@beacon/core` (Task 2) and the new `scans.source` column (Task 1).
- Produces: scans recorded with a `source` value derived from `?ref=` + external referrer.

- [ ] **Step 1: Add `source` to the ScanRecord contract + both record impls**

In `apps/web/lib/scans.ts`:
- Add to the `ScanRecord` interface: `  /** Attribution source (campaign ref / referrer). Omitted for unattributed scans. */\n  source?: string;`
- In `createMemoryScanHistory.record`, include `source` when pushing the row (store it on the pushed object; it is not read back by any existing method, so just persist it): add `source: r.source` to the pushed object literal.
- In `createPgScanHistory.record`, change the INSERT to include the column:

```ts
      await pool.query(
        `INSERT INTO scans (slug, name, grade, overall, rubric_version, category_scores, login, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [r.slug, r.name, r.grade, r.overall, r.rubricVersion, r.categoryScores ? JSON.stringify(r.categoryScores) : null, r.login ?? null, r.source ?? null],
      );
```

- [ ] **Step 2: Add `source?` to `recordScans`**

In `apps/web/lib/record.ts`, change the signature and the `record` call:

```ts
export function recordScans(
  owner: string,
  repo: string,
  skills: readonly ScannedSkill[],
  login?: string,
  source?: string,
): Promise<void> {
```

and in the `.record({...})` object add: `...(source ? { source } : {}),` (alongside the existing `...(login ? { login } : {})`).

- [ ] **Step 3: Compute + pass source at both call sites**

Add a small helper near the top of EACH route file (or inline). In `app/s/[...slug]/route.ts` and `app/api/gallery/opt-in/route.ts`, add the import and helper:

```ts
import { normalizeSource } from "@beacon/core";

/** The Referer host, but only when it is a different origin than this request (else null). */
function externalRefererHost(req: Request): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    const h = new URL(ref).host;
    return h && h !== new URL(req.url).host ? h : null;
  } catch {
    return null;
  }
}
```

Then change the `recordScans(...)` call in each file:

```ts
  const source = normalizeSource(new URL(req.url).searchParams.get("ref"), externalRefererHost(req)) ?? undefined;
  after(() => recordScans(target.owner, target.repo, scan.skills, viewer, source));
```

(Keep the existing `viewer`/`login` argument exactly as it was; only append `source`.)

- [ ] **Step 4: Typecheck**

Run: `npm run build --workspace @beacon/core && npm run typecheck --workspace @beacon/web`
Expected: no type errors. (`@beacon/core` must be rebuilt so `normalizeSource` resolves.)

- [ ] **Step 5: Run the web test suite (no regressions)**

Run: `npm test`
Expected: all green (63+ files). The `source` field is additive/optional — existing scans tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/scans.ts apps/web/lib/record.ts "apps/web/app/s/[...slug]/route.ts" apps/web/app/api/gallery/opt-in/route.ts
git commit -m "feat(demand): attribute scans to a source at both recording call sites"
```

---

### Task 6: Show source + conversion on the dashboard panel

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: the new `DemandMetric` fields (Task 3) via the existing `computeDemandMetric` call in the owner-gated panel (slice #1).

- [ ] **Step 1: Extend the panel JSX**

In `apps/web/app/dashboard/page.tsx`, inside the existing `{demand && ( ... )}` panel `<section>`, after the existing `<div className="bars">…</div>`, add:

```tsx
          {demand.metric.externalScansBySource.length > 0 && (
            <>
              <h3>Scans by source</h3>
              <ul>
                {demand.metric.externalScansBySource.map((s) => (
                  <li key={s.source}>
                    {s.source}: {s.count.toLocaleString()}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>Conversion (external-scanned repos → distribution)</h3>
          <ul>
            <li>badge embedded (GitHub): {demand.metric.reposWithBadgeServe.toLocaleString()} / {demand.metric.distinctExternalRepos.toLocaleString()}</li>
            <li>gallery opt-in: {demand.metric.reposWithGalleryOptIn.toLocaleString()} / {demand.metric.distinctExternalRepos.toLocaleString()}</li>
          </ul>
```

- [ ] **Step 2: Typecheck + full build**

Run: `npm run build --workspace @beacon/core && npm run typecheck --workspace @beacon/web && npm run build --workspace @beacon/web`
Expected: clean.

- [ ] **Step 3: Visual verification (BINDING — UI change; DEFERRED if no creds)**

Per the repo rule, the owner-view must be screenshotted before "done". This needs prod `DATABASE_URL` + an `sgharlow` session — if unavailable in the implementation environment, report Step 3 as DEFERRED (live-proven step), same as slice #1's panel. When creds are available: load `/dashboard` as owner, confirm the "Scans by source" list and "Conversion" lines render with real numbers matching `npm run report:demand`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat(demand): show scans-by-source + conversion on the owner dashboard panel"
```

---

## Final verification

- [ ] Full suite: `npm test` — all green including the new source/metric/format tests.
- [ ] Typecheck: `npm run build --workspace @beacon/core && npm run typecheck` — clean.
- [ ] Trailer check across new commits: `git log <base>..HEAD --format=%B | grep -ciE "co-authored-by: claude|noreply@anthropic"` prints `0`.
- [ ] Claim ladder: **built** after tests+typecheck green. **live-proven** requires (deferred, needs prod creds): run `migrate-scan-source.mjs` on prod, deploy, confirm a `?ref=reddit` scan lands with `source='reddit'`, and the readout/panel show by-source + conversion against real data.

## Self-Review (author)

- **Spec coverage:** additive `scans.source` migration (Task 1) ✓; pure `normalizeSource` ref>referrer>null (Task 2) ✓; by-source + two conversion joins additive to `DemandMetric` (Task 3) ✓; terminal render (Task 4) ✓; attribution wired at both call sites with same-origin-filtered referrer (Task 5) ✓; dashboard panel (Task 6) ✓; owner exclusion reused (`EXTERNAL` + aliased predicate) ✓; contract additive/no-break ✓.
- **Placeholder scan:** none — full code in every step.
- **Cross-task compile hazard handled:** Task 3 Step 4 fixes both `DemandMetric` literal fixtures (gate + format) that the new interface fields would otherwise break; Task 3 Step 1 anchors the `gallery_entries` handler so the opt-in-count and conversion-join queries don't collide.
- **Type consistency:** `SourceCount`, `externalScansBySource`, `reposWithBadgeServe`, `reposWithGalleryOptIn`, `normalizeSource` used identically across metric/format/panel/tests. `source?` optional on `ScanRecord` and `recordScans`.
