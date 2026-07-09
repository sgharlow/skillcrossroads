#!/usr/bin/env node
// Apply db/schema.sql to DATABASE_URL. Idempotent. Usage: DATABASE_URL=... node db/migrate.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "schema.sql"), "utf8");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
try {
  await pool.query(sql);
  console.log("Crossroads schema applied.");
} finally {
  await pool.end();
}
