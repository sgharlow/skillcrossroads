#!/usr/bin/env node
// G0 demand readout. Reads prod/local DB directly and prints the gate + numbers.
// Usage (from apps/web): OWNER_LOGINS=sgharlow DATABASE_URL=... npm run report:demand
//
// Exit codes — a VERDICT is not a FAILURE, so they never share a code:
//   0  readout ran; verdict is not pivot
//   1  readout ran; verdict is PIVOT (kept from the original design, so it can gate CI)
//   2  config missing (DATABASE_URL unset)
//   3  readout CRASHED (DB unreachable, query error, ...) — prints "READOUT FAILED: ..."
// Until 2026-10-19 a crash surfaced as an unhandled rejection, which Node exits with 1 — the
// pivot code — so a dead database read as a pivot verdict to anything checking the code.
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
} catch (err) {
  console.error(`READOUT FAILED: ${err?.name ?? "Error"}: ${err?.message ?? err}`);
  process.exitCode = 3;
} finally {
  await pool.end().catch(() => {});
}
