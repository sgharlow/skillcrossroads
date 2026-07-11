// One-off migration: the badge_serves table behind the "badges in the wild" dashboard metric.
// Run with DATABASE_URL set (reads apps/web/.env.local when run from the repo):
//   node apps/web/scripts/migrate-badge-serves.mjs
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) {
  const envFile = join(here, "..", ".env.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const m = /^DATABASE_URL=(.+)$/.exec(line.trim());
      if (m) process.env.DATABASE_URL = m[1];
    }
  }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: local ? false : { rejectUnauthorized: false },
  max: 1,
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS badge_serves (
    id bigserial PRIMARY KEY,
    slug text NOT NULL,
    from_github boolean NOT NULL DEFAULT false,
    served_at timestamptz NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS badge_serves_served_at_idx ON badge_serves (served_at)`);
const check = await pool.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'badge_serves' ORDER BY ordinal_position`,
);
console.log("badge_serves columns:", check.rows.map((r) => r.column_name).join(", "));
await pool.end();
console.log("migration OK");
