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
