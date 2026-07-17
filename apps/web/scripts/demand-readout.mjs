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
