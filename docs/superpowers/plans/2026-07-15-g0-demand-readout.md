# G0 Demand-Signal Readout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ROADMAP Gate G0 measurable — count external (non-owner) scans, evaluate the PASS/PIVOT threshold as code, and surface it in a terminal report and an owner-gated dashboard panel.

**Architecture:** The pure demand logic (config parsing, metric computation with an injected SQL runner, G0 gate evaluation, text formatting) lives in `@beacon/core` under `src/demand/`. Both consumers reuse it: the terminal script (`apps/web/scripts/demand-readout.mjs`) imports the built `@beacon/core` and passes a `pg.Pool`; the dashboard server component imports the same functions and passes the app's existing pool. No new tables, no write path — read-only over existing `scans`, `badge_serves`, `gallery_entries`, `subscriptions`.

**Tech Stack:** TypeScript (NodeNext ESM), `@beacon/core` package, `pg`, Next.js App Router (server component), Vitest.

> **Deviation from the approved spec (2026-07-15-g0-demand-readout-design.md):** the spec placed `demand.ts`/`g0-gate.ts` in `apps/web/lib`. They are instead in `@beacon/core/src/demand/` so the plain-node `.mjs` terminal script can reuse them (the repo has no `tsx`/`ts-node`; `.mjs` scripts consume built `@beacon/core` — the established pattern). Behavior and components are unchanged; only the module location differs.

## Global Constraints

- **Node:** 22.x (repo `engines` is pinned; do not rely on newer APIs).
- **ESM specifiers:** `@beacon/core` is NodeNext ESM — every relative import specifier ends in `.js` (e.g. `import { X } from "./metric.js"`), even though the source file is `.ts`.
- **Tests:** Vitest with `globals: false` — every test file starts with `import { describe, it, expect } from "vitest";`. Test glob: `packages/*/test/**/*.test.ts` and `apps/*/test/**/*.test.ts`. Run with `npm test` (root, `vitest run`).
- **Determinism:** core functions take `now: Date` as a parameter — never call `Date.now()`/`new Date()` inside `@beacon/core` (matches core's pure style; callers inject the clock).
- **Core rebuild:** `@beacon/core` compiles to `dist/`. After editing core, run `npm run build --workspace @beacon/core` before the web typecheck/build or before running the terminal script (web and the `.mjs` resolve core via its built `dist/index.js`).
- **Owner logins:** never hardcode `sgharlow` in source — it comes from the `OWNER_LOGINS` env var (default handling: empty ⇒ nobody excluded). Deployment sets `OWNER_LOGINS=sgharlow`.
- **Commits:** conventional-commit style matching the repo (`feat:`, `docs:`, `test:`). **Do NOT add a `Co-Authored-By: Claude` trailer** — verify each commit body: `git log -1 --format=%B | grep -ciE "co-authored-by: claude|noreply@anthropic"` must print `0`.

## Existing schema (read-only, do not modify)

- `scans(slug text, name text, grade text, overall numeric, rubric_version text, category_scores jsonb, login text NULL, scanned_at timestamptz)` — `login` NULL ⇒ anonymous.
- `badge_serves(id bigserial, slug text, from_github boolean, served_at timestamptz)`.
- `gallery_entries(id text, owner text, repo text, path text, name text, grade text, scanned_at date, created_at timestamptz, …)`.
- `subscriptions(login text PK, pro boolean, stripe_customer_id text, updated_at timestamptz)`.

## File Structure

- Create `packages/core/src/demand/config.ts` — env → `DemandConfig`.
- Create `packages/core/src/demand/metric.ts` — `Queryable`, `DemandMetric`, `computeDemandMetric`.
- Create `packages/core/src/demand/g0-gate.ts` — `evaluateG0`, `G0Verdict`.
- Create `packages/core/src/demand/format.ts` — `formatDemandReadout`.
- Modify `packages/core/src/index.ts` — export the four modules.
- Create tests `packages/core/test/demand-config.test.ts`, `demand-metric.test.ts`, `demand-g0-gate.test.ts`, `demand-format.test.ts`.
- Create `apps/web/scripts/demand-readout.mjs` — terminal report; add `report:demand` npm script.
- Modify `apps/web/app/dashboard/page.tsx` — owner-gated Demand/G0 panel.

---

### Task 1: Demand config parsing

**Files:**
- Create: `packages/core/src/demand/config.ts`
- Test: `packages/core/test/demand-config.test.ts`

**Interfaces:**
- Produces: `interface DemandConfig { ownerLogins: Set<string>; launchDate: string | null; launchPosts: number; trendDays: number }` and `function readDemandConfig(env: Record<string, string | undefined>): DemandConfig`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/demand-config.test.ts
import { describe, it, expect } from "vitest";
import { readDemandConfig } from "../src/demand/config.js";

describe("readDemandConfig", () => {
  it("parses owner logins lowercased, trimmed, comma-separated", () => {
    const c = readDemandConfig({ OWNER_LOGINS: "sgharlow, Foo ,,BAR" });
    expect([...c.ownerLogins].sort()).toEqual(["bar", "foo", "sgharlow"]);
  });
  it("defaults: no owners, pre-launch, 0 posts, 30 trend days", () => {
    const c = readDemandConfig({});
    expect(c.ownerLogins.size).toBe(0);
    expect(c.launchDate).toBeNull();
    expect(c.launchPosts).toBe(0);
    expect(c.trendDays).toBe(30);
  });
  it("accepts a valid ISO launch date, rejects malformed", () => {
    expect(readDemandConfig({ LAUNCH_DATE: "2026-07-20" }).launchDate).toBe("2026-07-20");
    expect(readDemandConfig({ LAUNCH_DATE: "July 20" }).launchDate).toBeNull();
  });
  it("clamps launchPosts and trendDays to positive integers", () => {
    expect(readDemandConfig({ LAUNCH_POSTS: "2" }).launchPosts).toBe(2);
    expect(readDemandConfig({ LAUNCH_POSTS: "-3" }).launchPosts).toBe(0);
    expect(readDemandConfig({ DEMAND_TREND_DAYS: "14" }).trendDays).toBe(14);
    expect(readDemandConfig({ DEMAND_TREND_DAYS: "0" }).trendDays).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- demand-config`
Expected: FAIL — cannot find module `../src/demand/config.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/demand/config.ts
/** Demand-readout configuration, derived once from environment variables. */
export interface DemandConfig {
  /** Lowercased GitHub logins to exclude from external counts (owner dogfooding). */
  ownerLogins: Set<string>;
  /** ISO date (YYYY-MM-DD) of the launch; null ⇒ pre-launch, gate inactive. */
  launchDate: string | null;
  /** Number of launch posts made so far (part of the pivot threshold). */
  launchPosts: number;
  /** Window (days) for the daily trend and badge leading indicators. */
  trendDays: number;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Read demand config from an environment map (`process.env` in prod, a literal in tests). */
export function readDemandConfig(env: Record<string, string | undefined>): DemandConfig {
  const ownerLogins = new Set(
    (env.OWNER_LOGINS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const launchRaw = (env.LAUNCH_DATE ?? "").trim();
  const launchDate = /^\d{4}-\d{2}-\d{2}$/.test(launchRaw) ? launchRaw : null;
  return {
    ownerLogins,
    launchDate,
    launchPosts: positiveInt(env.LAUNCH_POSTS, 0),
    trendDays: positiveInt(env.DEMAND_TREND_DAYS, 30),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- demand-config`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/demand/config.ts packages/core/test/demand-config.test.ts
git commit -m "feat(demand): env-driven demand config parser"
```

---

### Task 2: Demand metric computation

**Files:**
- Create: `packages/core/src/demand/metric.ts`
- Test: `packages/core/test/demand-metric.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface Queryable { query(text: string, params?: unknown[]): Promise<{ rows: any[] }> }`
  - `interface DailyCount { day: string; count: number }`
  - `interface DemandMetric { externalScansTotal: number; externalScansSinceLaunch: number; attributedExternalLogins: number; anonymousScans: number; distinctExternalRepos: number; dailyExternalTrend: DailyCount[]; badgeServesInWindow: number; distinctBadgeReposFromGitHub: number; galleryOptIns: number; paidSubscriptions: number }`
  - `interface DemandMetricOpts { ownerLogins: Set<string>; launchDate: string | null; trendDays: number }`
  - `function computeDemandMetric(db: Queryable, opts: DemandMetricOpts): Promise<DemandMetric>`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/demand-metric.test.ts
import { describe, it, expect } from "vitest";
import { computeDemandMetric, type Queryable } from "../src/demand/metric.js";

/** Fake Queryable that returns rows for the first handler whose regex matches the SQL. */
function fakeDb(handlers: Array<[RegExp, any[]]>): Queryable {
  return {
    query(text: string) {
      for (const [re, rows] of handlers) if (re.test(text)) return Promise.resolve({ rows });
      return Promise.reject(new Error("unexpected query: " + text.replace(/\s+/g, " ").trim()));
    },
  };
}

describe("computeDemandMetric", () => {
  it("aggregates external counts and excludes owners; anonymous reported separately", async () => {
    const db = fakeDb([
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL.*scanned_at >= \$2/s, [{ n: 3 }]], // since launch
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL/s, [{ n: 7 }]], // external total
      [/count\(DISTINCT lower\(login\)\)::int AS n FROM scans/s, [{ n: 2 }]], // attributed logins
      [/count\(\*\)::int AS n FROM scans WHERE login IS NULL/s, [{ n: 4 }]], // anonymous
      [/count\(DISTINCT slug\)::int AS n FROM scans WHERE \(login IS NULL/s, [{ n: 5 }]], // distinct repos
      [/GROUP BY 1 ORDER BY 1/s, [{ day: "2026-07-14", count: 1 }, { day: "2026-07-15", count: 2 }]], // trend
      [/FROM badge_serves WHERE served_at/s, [{ n: 9 }]], // badge serves in window
      [/FROM badge_serves\s+WHERE from_github = true/s, [{ n: 6 }]], // badge repos via github
      [/FROM gallery_entries/s, [{ n: 8 }]],
      [/FROM subscriptions WHERE pro = true/s, [{ n: 1 }]],
    ]);
    const m = await computeDemandMetric(db, {
      ownerLogins: new Set(["sgharlow"]),
      launchDate: "2026-07-13",
      trendDays: 30,
    });
    expect(m.externalScansTotal).toBe(7);
    expect(m.externalScansSinceLaunch).toBe(3);
    expect(m.attributedExternalLogins).toBe(2);
    expect(m.anonymousScans).toBe(4);
    expect(m.distinctExternalRepos).toBe(5);
    expect(m.dailyExternalTrend).toEqual([
      { day: "2026-07-14", count: 1 },
      { day: "2026-07-15", count: 2 },
    ]);
    expect(m.badgeServesInWindow).toBe(9);
    expect(m.distinctBadgeReposFromGitHub).toBe(6);
    expect(m.galleryOptIns).toBe(8);
    expect(m.paidSubscriptions).toBe(1);
  });

  it("returns externalScansSinceLaunch = 0 when there is no launch date (no date query issued)", async () => {
    const db = fakeDb([
      [/count\(\*\)::int AS n FROM scans WHERE \(login IS NULL(?!.*scanned_at)/s, [{ n: 5 }]],
      [/count\(DISTINCT lower\(login\)\)/s, [{ n: 0 }]],
      [/scans WHERE login IS NULL/s, [{ n: 5 }]],
      [/count\(DISTINCT slug\)/s, [{ n: 2 }]],
      [/GROUP BY 1 ORDER BY 1/s, []],
      [/FROM badge_serves WHERE served_at/s, [{ n: 0 }]],
      [/from_github = true/s, [{ n: 0 }]],
      [/FROM gallery_entries/s, [{ n: 0 }]],
      [/FROM subscriptions/s, [{ n: 0 }]],
    ]);
    const m = await computeDemandMetric(db, { ownerLogins: new Set(), launchDate: null, trendDays: 30 });
    expect(m.externalScansSinceLaunch).toBe(0);
    expect(m.externalScansTotal).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- demand-metric`
Expected: FAIL — cannot find module `../src/demand/metric.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/demand/metric.ts

/** Minimal structural interface satisfied by a pg Pool/Client — lets tests inject a fake. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

export interface DailyCount {
  day: string; // YYYY-MM-DD
  count: number;
}

export interface DemandMetric {
  externalScansTotal: number;
  externalScansSinceLaunch: number;
  attributedExternalLogins: number;
  anonymousScans: number;
  distinctExternalRepos: number;
  dailyExternalTrend: DailyCount[];
  badgeServesInWindow: number;
  distinctBadgeReposFromGitHub: number;
  galleryOptIns: number;
  paidSubscriptions: number;
}

export interface DemandMetricOpts {
  ownerLogins: Set<string>;
  launchDate: string | null;
  trendDays: number;
}

// External = anonymous (login IS NULL) OR a login that is not an owner. `<> ALL($1)` is TRUE for
// every row when $1 is an empty array, so an empty owner list counts everything as external.
const EXTERNAL = "(login IS NULL OR lower(login) <> ALL($1::text[]))";

/** The single authoritative computation of the G0 demand signal. Owner exclusion lives ONLY here. */
export async function computeDemandMetric(db: Queryable, opts: DemandMetricOpts): Promise<DemandMetric> {
  const owners = [...opts.ownerLogins]; // lowercased text[]
  const days = Math.max(1, Math.trunc(opts.trendDays));

  const scalar = async (text: string, params: unknown[]): Promise<number> =>
    Number((await db.query(text, params)).rows[0]?.n ?? 0);

  const externalScansTotal = await scalar(
    `SELECT count(*)::int AS n FROM scans WHERE ${EXTERNAL}`,
    [owners],
  );
  const externalScansSinceLaunch = opts.launchDate
    ? await scalar(
        `SELECT count(*)::int AS n FROM scans WHERE ${EXTERNAL} AND scanned_at >= $2::date`,
        [owners, opts.launchDate],
      )
    : 0;
  const attributedExternalLogins = await scalar(
    `SELECT count(DISTINCT lower(login))::int AS n FROM scans
     WHERE login IS NOT NULL AND lower(login) <> ALL($1::text[])`,
    [owners],
  );
  const anonymousScans = await scalar(`SELECT count(*)::int AS n FROM scans WHERE login IS NULL`, []);
  const distinctExternalRepos = await scalar(
    `SELECT count(DISTINCT slug)::int AS n FROM scans WHERE ${EXTERNAL}`,
    [owners],
  );
  const dailyExternalTrend = (
    await db.query(
      `SELECT to_char(scanned_at::date, 'YYYY-MM-DD') AS day, count(*)::int AS count
       FROM scans
       WHERE ${EXTERNAL} AND scanned_at >= (CURRENT_DATE - ($2::int - 1))
       GROUP BY 1 ORDER BY 1`,
      [owners, days],
    )
  ).rows as DailyCount[];
  const badgeServesInWindow = await scalar(
    `SELECT count(*)::int AS n FROM badge_serves WHERE served_at >= (CURRENT_DATE - ($1::int - 1))`,
    [days],
  );
  const distinctBadgeReposFromGitHub = await scalar(
    `SELECT count(DISTINCT slug)::int AS n FROM badge_serves
     WHERE from_github = true AND served_at >= (CURRENT_DATE - ($1::int - 1))`,
    [days],
  );
  const galleryOptIns = await scalar(`SELECT count(*)::int AS n FROM gallery_entries`, []);
  const paidSubscriptions = await scalar(`SELECT count(*)::int AS n FROM subscriptions WHERE pro = true`, []);

  return {
    externalScansTotal,
    externalScansSinceLaunch,
    attributedExternalLogins,
    anonymousScans,
    distinctExternalRepos,
    dailyExternalTrend,
    badgeServesInWindow,
    distinctBadgeReposFromGitHub,
    galleryOptIns,
    paidSubscriptions,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- demand-metric`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/demand/metric.ts packages/core/test/demand-metric.test.ts
git commit -m "feat(demand): external-scan demand metric with injected SQL runner"
```

---

### Task 3: G0 gate evaluator

**Files:**
- Create: `packages/core/src/demand/g0-gate.ts`
- Test: `packages/core/test/demand-g0-gate.test.ts`

**Interfaces:**
- Consumes: `DemandMetric` from `./metric.js`.
- Produces:
  - `type G0Status = "pre-launch" | "live-signal" | "pivot-warning" | "pivot"`
  - `interface G0Verdict { status: G0Status; reasons: string[] }`
  - `interface G0Context { launchDate: string | null; launchPosts: number; now: Date }`
  - `function evaluateG0(metric: DemandMetric, ctx: G0Context): G0Verdict`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/demand-g0-gate.test.ts
import { describe, it, expect } from "vitest";
import { evaluateG0 } from "../src/demand/g0-gate.js";
import type { DemandMetric } from "../src/demand/metric.js";

const base: DemandMetric = {
  externalScansTotal: 0, externalScansSinceLaunch: 0, attributedExternalLogins: 0,
  anonymousScans: 0, distinctExternalRepos: 0, dailyExternalTrend: [],
  badgeServesInWindow: 0, distinctBadgeReposFromGitHub: 0, galleryOptIns: 0, paidSubscriptions: 0,
};

describe("evaluateG0", () => {
  it("pre-launch when no launch date", () => {
    const v = evaluateG0(base, { launchDate: null, launchPosts: 0, now: new Date("2026-07-15T00:00:00Z") });
    expect(v.status).toBe("pre-launch");
  });
  it("live-signal on the first external scan since launch", () => {
    const v = evaluateG0({ ...base, externalScansSinceLaunch: 1 },
      { launchDate: "2026-07-13", launchPosts: 3, now: new Date("2026-08-20T00:00:00Z") });
    expect(v.status).toBe("live-signal");
  });
  it("pivot-warning when launched, zero scans, before the 4-week / 2-post threshold", () => {
    const v = evaluateG0(base,
      { launchDate: "2026-07-13", launchPosts: 1, now: new Date("2026-07-20T00:00:00Z") });
    expect(v.status).toBe("pivot-warning");
  });
  it("pivot when zero external scans after >=2 posts and >=4 weeks", () => {
    const v = evaluateG0(base,
      { launchDate: "2026-07-13", launchPosts: 2, now: new Date("2026-08-15T00:00:00Z") });
    expect(v.status).toBe("pivot");
  });
  it("stays pivot-warning at 4 weeks if fewer than 2 posts", () => {
    const v = evaluateG0(base,
      { launchDate: "2026-07-13", launchPosts: 1, now: new Date("2026-08-15T00:00:00Z") });
    expect(v.status).toBe("pivot-warning");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- demand-g0-gate`
Expected: FAIL — cannot find module `../src/demand/g0-gate.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/demand/g0-gate.ts
import type { DemandMetric } from "./metric.js";

export type G0Status = "pre-launch" | "live-signal" | "pivot-warning" | "pivot";

export interface G0Verdict {
  status: G0Status;
  reasons: string[];
}

export interface G0Context {
  launchDate: string | null;
  launchPosts: number;
  now: Date;
}

const PIVOT_WEEKS = 4;
const PIVOT_MIN_POSTS = 2;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Encode the ROADMAP G0 gate: launch ⇒ external scans>0 (pass); 2 posts + 4 weeks + zero ⇒ pivot. */
export function evaluateG0(metric: DemandMetric, ctx: G0Context): G0Verdict {
  if (!ctx.launchDate) {
    return { status: "pre-launch", reasons: ["No LAUNCH_DATE set — gate not yet active."] };
  }
  if (metric.externalScansSinceLaunch > 0) {
    return {
      status: "live-signal",
      reasons: [`${metric.externalScansSinceLaunch} external scan(s) since ${ctx.launchDate}.`],
    };
  }
  const weeks = (ctx.now.getTime() - new Date(ctx.launchDate + "T00:00:00Z").getTime()) / WEEK_MS;
  if (ctx.launchPosts >= PIVOT_MIN_POSTS && weeks >= PIVOT_WEEKS) {
    return {
      status: "pivot",
      reasons: [
        `Zero external scans after ${ctx.launchPosts} launch post(s) and ${weeks.toFixed(1)} weeks.`,
        "ROADMAP threshold met — stop feature work, pivot.",
      ],
    };
  }
  const weeksLeft = Math.max(0, PIVOT_WEEKS - weeks);
  const postsLeft = Math.max(0, PIVOT_MIN_POSTS - ctx.launchPosts);
  return {
    status: "pivot-warning",
    reasons: [
      "Launched but zero external scans so far.",
      `Pivot triggers in ${weeksLeft.toFixed(1)} more week(s)` +
        (postsLeft > 0 ? ` and ${postsLeft} more launch post(s).` : "."),
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- demand-g0-gate`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/demand/g0-gate.ts packages/core/test/demand-g0-gate.test.ts
git commit -m "feat(demand): pure G0 gate evaluator encoding the ROADMAP threshold"
```

---

### Task 4: Terminal formatter

**Files:**
- Create: `packages/core/src/demand/format.ts`
- Test: `packages/core/test/demand-format.test.ts`

**Interfaces:**
- Consumes: `DemandMetric` from `./metric.js`, `G0Verdict` from `./g0-gate.js`.
- Produces: `function formatDemandReadout(metric: DemandMetric, verdict: G0Verdict): string`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/demand-format.test.ts
import { describe, it, expect } from "vitest";
import { formatDemandReadout } from "../src/demand/format.js";
import type { DemandMetric } from "../src/demand/metric.js";
import type { G0Verdict } from "../src/demand/g0-gate.js";

const metric: DemandMetric = {
  externalScansTotal: 7, externalScansSinceLaunch: 3, attributedExternalLogins: 2,
  anonymousScans: 4, distinctExternalRepos: 5, dailyExternalTrend: [{ day: "2026-07-15", count: 2 }],
  badgeServesInWindow: 9, distinctBadgeReposFromGitHub: 6, galleryOptIns: 8, paidSubscriptions: 1,
};
const verdict: G0Verdict = { status: "live-signal", reasons: ["3 external scan(s) since 2026-07-13."] };

describe("formatDemandReadout", () => {
  it("renders the verdict, its reasons, and the key numbers", () => {
    const out = formatDemandReadout(metric, verdict);
    expect(out).toContain("LIVE SIGNAL");
    expect(out).toContain("3 external scan(s) since 2026-07-13.");
    expect(out).toContain("external scans (since launch): 3");
    expect(out).toContain("distinct external logins  : 2");
    expect(out).toContain("anonymous scans           : 4");
    expect(out).toContain("badge repos via GitHub    : 6");
    expect(out).toContain("paid subscriptions        : 1");
    expect(out).toContain("2026-07-15");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- demand-format`
Expected: FAIL — cannot find module `../src/demand/format.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/demand/format.ts
import type { DemandMetric } from "./metric.js";
import type { G0Verdict } from "./g0-gate.js";

const LABEL: Record<string, string> = {
  "pre-launch": "○ PRE-LAUNCH",
  "live-signal": "● LIVE SIGNAL",
  "pivot-warning": "▲ PIVOT WARNING",
  pivot: "✖ PIVOT",
};

/** Render the demand readout as plain text for the terminal (no color dependency required). */
export function formatDemandReadout(metric: DemandMetric, verdict: G0Verdict): string {
  const L: string[] = [];
  L.push(`G0 GATE: ${LABEL[verdict.status] ?? verdict.status}`);
  for (const r of verdict.reasons) L.push(`  - ${r}`);
  L.push("");
  L.push("External demand (owner logins excluded):");
  L.push(`  external scans (all-time)   : ${metric.externalScansTotal}`);
  L.push(`  external scans (since launch): ${metric.externalScansSinceLaunch}`);
  L.push(`  distinct external logins  : ${metric.attributedExternalLogins}`);
  L.push(`  anonymous scans           : ${metric.anonymousScans}  (cannot attribute stranger vs logged-out owner)`);
  L.push(`  distinct external repos   : ${metric.distinctExternalRepos}`);
  L.push("");
  L.push("Leading indicators:");
  L.push(`  badge serves (window)     : ${metric.badgeServesInWindow}`);
  L.push(`  badge repos via GitHub    : ${metric.distinctBadgeReposFromGitHub}`);
  L.push(`  gallery opt-ins           : ${metric.galleryOptIns}`);
  L.push(`  paid subscriptions        : ${metric.paidSubscriptions}`);
  if (metric.dailyExternalTrend.length) {
    L.push("");
    L.push("Daily external scans:");
    for (const d of metric.dailyExternalTrend) {
      L.push(`  ${d.day}  ${"#".repeat(Math.min(40, d.count))} ${d.count}`);
    }
  }
  return L.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- demand-format`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/demand/format.ts packages/core/test/demand-format.test.ts
git commit -m "feat(demand): plain-text terminal formatter for the readout"
```

---

### Task 5: Export from core + terminal script

**Files:**
- Modify: `packages/core/src/index.ts` (add exports near the other `export {…}` lines)
- Create: `apps/web/scripts/demand-readout.mjs`
- Modify: `apps/web/package.json` (add `report:demand` script)

**Interfaces:**
- Consumes: all four demand modules from Tasks 1-4.
- Produces: `npm run report:demand` (run from `apps/web`) printing the readout; exit code 1 on `pivot`, else 0.

- [ ] **Step 1: Add core exports**

In `packages/core/src/index.ts`, add:

```ts
export { readDemandConfig, type DemandConfig } from "./demand/config.js";
export {
  computeDemandMetric,
  type Queryable,
  type DemandMetric,
  type DailyCount,
  type DemandMetricOpts,
} from "./demand/metric.js";
export { evaluateG0, type G0Verdict, type G0Status, type G0Context } from "./demand/g0-gate.js";
export { formatDemandReadout } from "./demand/format.js";
```

- [ ] **Step 2: Build core and verify exports resolve**

Run: `npm run build --workspace @beacon/core`
Expected: builds clean; `packages/core/dist/demand/metric.js` exists.
Run: `node -e "import('@beacon/core').then(m=>console.log(typeof m.computeDemandMetric, typeof m.evaluateG0, typeof m.readDemandConfig, typeof m.formatDemandReadout))"`
Expected: `function function function function`.

- [ ] **Step 3: Write the terminal script**

```js
// apps/web/scripts/demand-readout.mjs
#!/usr/bin/env node
// G0 demand readout. Reads prod/local DB directly and prints the gate + numbers.
// Usage (from apps/web): OWNER_LOGINS=sgharlow DATABASE_URL=... npm run report:demand
import { Pool } from "pg";
import {
  readDemandConfig,
  computeDemandMetric,
  evaluateG0,
  formatDemandReadout,
} from "@beacon/core";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(2);
}

const cfg = readDemandConfig(process.env);
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: local ? false : { rejectUnauthorized: false },
  max: 3,
});

try {
  const metric = await computeDemandMetric(pool, {
    ownerLogins: cfg.ownerLogins,
    launchDate: cfg.launchDate,
    trendDays: cfg.trendDays,
  });
  const verdict = evaluateG0(metric, {
    launchDate: cfg.launchDate,
    launchPosts: cfg.launchPosts,
    now: new Date(),
  });
  console.log(formatDemandReadout(metric, verdict));
  process.exitCode = verdict.status === "pivot" ? 1 : 0;
} finally {
  await pool.end();
}
```

- [ ] **Step 4: Add the npm script**

In `apps/web/package.json` `scripts`, add:

```json
"report:demand": "node scripts/demand-readout.mjs"
```

- [ ] **Step 5: Run it against the real database (live-proven step)**

Run (from `apps/web`, with the prod `DATABASE_URL` and `OWNER_LOGINS=sgharlow` in the environment/`.env`):
`npm run report:demand`
Expected: prints the readout block. With no `LAUNCH_DATE` set, `G0 GATE: ○ PRE-LAUNCH` and real current counts (external scans, anonymous, badges, etc.). Exit code 0.
If it errors on TLS to a managed DB, confirm `DATABASE_URL` and that `sslmode` matches `lib/db.ts` behavior (encrypted, unverified fallback).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/index.ts apps/web/scripts/demand-readout.mjs apps/web/package.json
git commit -m "feat(demand): report:demand terminal readout wired to @beacon/core"
```

---

### Task 6: Owner-gated dashboard panel

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `readDemandConfig`, `computeDemandMetric`, `evaluateG0` from `@beacon/core`; `getPool`, `hasDb` from `@/lib/db`; `readSessionFromCookieHeader`, `trustLogin` from `@/lib/session`; `cookies` from `next/headers`.
- Produces: an owner-only "Demand / G0" panel on `/dashboard`. Non-owners see the page unchanged.

The dashboard is a **public** metrics page (`robots: index:false`, no auth). The demand panel reveals launch strategy and pre-launch zeros, so it renders ONLY for an owner login. Mirror the session read used in `apps/web/app/account/page.tsx` (`cookies()` → `readSessionFromCookieHeader` → `trustLogin`).

- [ ] **Step 1: Add owner detection + demand fetch at the top of the component**

In `apps/web/app/dashboard/page.tsx`, add imports:

```ts
import { cookies } from "next/headers";
import { readSessionFromCookieHeader, trustLogin } from "@/lib/session";
import { hasDb, getPool } from "@/lib/db";
import { readDemandConfig, computeDemandMetric, evaluateG0 } from "@beacon/core";
```

Inside `export default async function Dashboard()`, before the `return`, add:

```ts
  // Owner-only demand panel. Never fail the page — degrade to null like the badge tile.
  const demand = await (async () => {
    try {
      const cfg = readDemandConfig(process.env);
      const store = await cookies();
      const header = store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
      const login = trustLogin(readSessionFromCookieHeader(header).login, true);
      if (!login || !cfg.ownerLogins.has(login.toLowerCase()) || !hasDb()) return null;
      const metric = await computeDemandMetric(getPool(), {
        ownerLogins: cfg.ownerLogins,
        launchDate: cfg.launchDate,
        trendDays: cfg.trendDays,
      });
      const verdict = evaluateG0(metric, {
        launchDate: cfg.launchDate,
        launchPosts: cfg.launchPosts,
        now: new Date(),
      });
      return { metric, verdict };
    } catch {
      return null;
    }
  })();
```

- [ ] **Step 2: Render the panel in the JSX**

Immediately after the opening `<SiteNav />` block's following `<h1>Metrics</h1>` (before the `<section className="tiles">`), add:

```tsx
      {demand && (
        <section className="panel" style={{ borderLeft: "3px solid #888", paddingLeft: "1rem" }}>
          <h2>Demand / G0 gate (owner-only)</h2>
          <p className="muted">{demand.verdict.status.toUpperCase().replace("-", " ")}</p>
          <ul>
            {demand.verdict.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <div className="bars">
            <div>external scans (all-time): {demand.metric.externalScansTotal.toLocaleString()}</div>
            <div>external scans (since launch): {demand.metric.externalScansSinceLaunch.toLocaleString()}</div>
            <div>distinct external logins: {demand.metric.attributedExternalLogins.toLocaleString()}</div>
            <div>anonymous scans: {demand.metric.anonymousScans.toLocaleString()}</div>
            <div>distinct external repos: {demand.metric.distinctExternalRepos.toLocaleString()}</div>
            <div>badge repos via GitHub: {demand.metric.distinctBadgeReposFromGitHub.toLocaleString()}</div>
            <div>gallery opt-ins: {demand.metric.galleryOptIns.toLocaleString()}</div>
            <div>paid subscriptions: {demand.metric.paidSubscriptions.toLocaleString()}</div>
          </div>
        </section>
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build --workspace @beacon/core && npm run typecheck --workspace @beacon/web`
Expected: no type errors.

- [ ] **Step 4: Verify rendering visually (BINDING — UI change)**

Per the repo rule "screenshot the rendered output before declaring done":
1. Start the dev server: `npm run dev --workspace @beacon/web` (or the repo's dev command).
2. Load `/dashboard` **signed out** → confirm the Demand/G0 panel is ABSENT and the public metrics still render.
3. Sign in as `sgharlow` (owner), reload `/dashboard` → confirm the Demand/G0 panel IS present with the verdict + numbers.
4. Capture a screenshot of the owner view and confirm the numbers match `npm run report:demand`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat(demand): owner-gated G0 demand panel on the metrics dashboard"
```

---

## Final verification

- [ ] Run the full suite: `npm test` (root) — all demand tests green, no regressions.
- [ ] Typecheck: `npm run build --workspace @beacon/core && npm run typecheck` — clean.
- [ ] Trailer check on all new commits: `git log origin/main..HEAD --format=%B | grep -ciE "co-authored-by: claude|noreply@anthropic"` prints `0`.
- [ ] Claim-ladder: this slice is **built** after tests+typecheck green; **live-proven** only after Task 5 Step 5 ran against the real DB and Task 6 Step 4 screenshot confirmed the panel. State which was reached in the completion note.

## Self-Review (author)

- **Spec coverage:** external-vs-owner classification (Task 2, `EXTERNAL` predicate + owner Set) ✓; anonymous reported separately (Task 2 `anonymousScans`, Task 4 line) ✓; G0 threshold as pure function (Task 3) ✓; terminal report (Task 5) ✓; owner-gated dashboard panel (Task 6) ✓; single authoritative definition (all in `@beacon/core`, owner exclusion only in `metric.ts`) ✓; read-only/no schema change ✓; `OWNER_LOGINS=sgharlow` via env ✓.
- **Placeholder scan:** none — every code/test step has full content.
- **Type consistency:** `Queryable`, `DemandMetric`, `DemandMetricOpts`, `G0Verdict`, `G0Context` names identical across Tasks 2/3/4/5/6; field names (`externalScansSinceLaunch`, `distinctBadgeReposFromGitHub`, etc.) consistent in metric, format, gate test fixtures, and panel JSX.
- **Deviation logged:** module location moved to `@beacon/core` (Architecture note) — behavior-neutral.
