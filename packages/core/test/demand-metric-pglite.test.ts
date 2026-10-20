import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { computeDemandMetric } from "../src/demand/metric.js";

/**
 * Real-SQL tests. The regex fake in demand-metric.test.ts only sees query TEXT, so it cannot tell
 * whether a WHERE clause actually excludes the owner. These run the real computeDemandMetric SQL
 * against an in-memory Postgres (PGlite) built from the app's own DDL, seeded only with planted
 * rows. Nothing here can reach a real database.
 */
const SCHEMA_SQL = fileURLToPath(new URL("../../../apps/web/db/schema.sql", import.meta.url));
// badge_serves and scans.source come from one-off migrations (apps/web/scripts/migrate-badge-serves.mjs,
// migrate-scan-source.mjs), not schema.sql; these mirror those statements.
const MIGRATIONS = `
  CREATE TABLE IF NOT EXISTS badge_serves (
    id bigserial PRIMARY KEY,
    slug text NOT NULL,
    from_github boolean NOT NULL DEFAULT false,
    served_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE scans ADD COLUMN IF NOT EXISTS source TEXT;
`;

const OWNER = "sgharlow";
const opts = { ownerLogins: new Set([OWNER]), launchDate: "2026-09-17", trendDays: 30 };

let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  // schema.sql revokes from Supabase's PostgREST roles; they must exist for it to apply.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;`);
  await db.exec(readFileSync(SCHEMA_SQL, "utf8"));
  await db.exec(MIGRATIONS);
});

afterEach(async () => {
  await db.close();
});

/** A scan as prod records it: login NULL on every row (2026-09-09 audit). */
async function scan(slug: string, source: string | null = null) {
  await db.query(
    `INSERT INTO scans (slug, name, grade, overall, rubric_version, login, source)
     VALUES ($1, 'x', 'B', 80, '1.2', NULL, $2)`,
    [slug, source],
  );
}
async function galleryEntry(id: string, owner: string, optedInBy: string | null) {
  const [, repo = "r", ...rest] = id.split("/");
  await db.query(
    `INSERT INTO gallery_entries (id, owner, repo, path, name, grade, overall, scanned_at, opted_in_by)
     VALUES ($1, $2, $3, $4, 'x', 'B', 80, CURRENT_DATE, $5)`,
    [id, owner, repo, rest.join("/") || ".", optedInBy],
  );
}
async function badge(slug: string) {
  await db.query(`INSERT INTO badge_serves (slug, from_github) VALUES ($1, true)`, [slug]);
}

describe("computeDemandMetric (real SQL) — conversion counts exclude the owner's own artifacts", () => {
  it("an owner-listed gallery entry and an owner-repo badge convert nothing", async () => {
    // The owner listed a corpus repo in the gallery himself (recorded actor = owner) …
    await scan("anthropics/skills/xlsx");
    await galleryEntry("anthropics/skills/xlsx", "anthropics", OWNER);
    // … and his own repo renders its badge on GitHub.
    await scan("sgharlow/claude-code-recipes/skill-a");
    await badge("sgharlow/claude-code-recipes/skill-a");

    const m = await computeDemandMetric(db, opts);
    // Arms-length counters already excluded both (unchanged by this fix) …
    expect(m.galleryOptIns).toBe(0);
    expect(m.distinctBadgeReposFromGitHub).toBe(0);
    // … and the conversion counters must agree with them (one assertion so a failure shows both).
    expect({ gallery: m.reposWithGalleryOptIn, badge: m.reposWithBadgeServe }).toEqual({
      gallery: 0,
      badge: 0,
    });
  });

  it("a legacy gallery row with no recorded actor converts nothing", async () => {
    await scan("anthropics/skills/pdf");
    await galleryEntry("anthropics/skills/pdf", "anthropics", null);
    const m = await computeDemandMetric(db, opts);
    expect(m.galleryOptIns).toBe(0);
    expect(m.reposWithGalleryOptIn).toBe(0);
  });

  // Positive control: a zero above is only evidence if a stranger's rows still count.
  it("a stranger's gallery opt-in and badge still count, in both arms-length and conversion", async () => {
    await scan("stranger/tools/skill-b", "google.com");
    await galleryEntry("stranger/tools/skill-b", "stranger", "stranger");
    await badge("stranger/tools/skill-b");
    const m = await computeDemandMetric(db, opts);
    expect(m.galleryOptIns).toBe(1);
    expect(m.distinctBadgeReposFromGitHub).toBe(1);
    expect(m.reposWithGalleryOptIn).toBe(1);
    expect(m.reposWithBadgeServe).toBe(1);
  });

  it("conversion badge uses the same served_at window as the arms-length badge count", async () => {
    await scan("stranger/tools/skill-c");
    await db.query(
      `INSERT INTO badge_serves (slug, from_github, served_at)
       VALUES ('stranger/tools/skill-c', true, now() - interval '90 days')`,
    );
    const m = await computeDemandMetric(db, opts);
    expect(m.distinctBadgeReposFromGitHub).toBe(0);
    expect(m.reposWithBadgeServe).toBe(0);
  });
});

/** A subscriptions row as entitlements.ts setPro writes it: keyed by the GitHub login. */
async function subscription(login: string, pro: boolean) {
  await db.query(`INSERT INTO subscriptions (login, pro, stripe_customer_id) VALUES ($1, $2, NULL)`, [
    login,
    pro,
  ]);
}

describe("computeDemandMetric (real SQL) — paid subscriptions exclude the owner", () => {
  it("the owner's own Pro row is not counted; a stranger's is", async () => {
    // Mixed case on purpose: OWNER_LOGINS matching is case-insensitive everywhere else.
    await subscription("SGHarlow", true);
    await subscription("stranger", true);
    const m = await computeDemandMetric(db, opts);
    expect(m.paidSubscriptions).toBe(1);
  });

  it("an owner-only Pro row reads 0, and a non-pro stranger row is not counted", async () => {
    await subscription(OWNER, true);
    await subscription("lapsed-stranger", false);
    const m = await computeDemandMetric(db, opts);
    expect(m.paidSubscriptions).toBe(0);
  });
});
