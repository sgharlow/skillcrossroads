#!/usr/bin/env node
/**
 * purge-gallery.mjs — removes embarrassing test-fixture rows from the production
 * `gallery_entries` table (skillcrossroads.com/gallery is a public, evidence-cited
 * safety-grading leaderboard; it must never show the repo's own test fixtures).
 *
 *   # dry run (default — prints what WOULD be deleted, deletes nothing):
 *   node apps/web/scripts/purge-gallery.mjs
 *
 *   # actually delete:
 *   node apps/web/scripts/purge-gallery.mjs --apply
 *
 * Delete criteria (exactly two, both must be matched against live DB rows before --apply):
 *   (a) every sgharlow/skillcrossroads row whose `path` contains "test/fixtures"
 *   (b) all sgharlow/info-worker-demo rows EXCEPT the 2 with the highest `overall`
 *       that have distinct names (keep exactly 2 representatives)
 *
 * Safety: reads DATABASE_URL from apps/web/.env.local itself (no dotenv dependency —
 * parses the file directly, so this always talks to the same DB the app uses). Dry-run
 * by default. Touches ONLY the gallery_entries table — no schema changes, no UPDATEs,
 * no other tables. Refuses to --apply unless a non-empty backup file path is confirmed
 * to exist first (BACKUP_FILE env var, or --backup=<path>).
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", ".env.local");

function parseEnvLocal(path) {
  const out = {};
  if (!existsSync(path)) return out;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function fail(msg) {
  process.stderr.write(`\n✗ ${msg}\n\n`);
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const backupArg = process.argv.find((a) => a.startsWith("--backup="));
const backupPath = backupArg ? backupArg.slice("--backup=".length) : process.env.BACKUP_FILE;

const env = parseEnvLocal(envPath);
const url = env.DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  fail(`DATABASE_URL not found in ${envPath} and not set in the environment.`);
}

if (apply) {
  if (!backupPath) {
    fail(
      "Refusing --apply without a verified backup.\n" +
        "  Pass the backup file: --backup=<path-to-json-backup>  (or set BACKUP_FILE=<path>)",
    );
  }
  if (!existsSync(backupPath)) {
    fail(`Backup file does not exist: ${backupPath}`);
  }
  const size = statSync(backupPath).size;
  if (size === 0) {
    fail(`Backup file is empty (0 bytes): ${backupPath}`);
  }
  let backupRows;
  try {
    backupRows = JSON.parse(readFileSync(backupPath, "utf8"));
  } catch (err) {
    fail(`Backup file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(backupRows) || backupRows.length === 0) {
    fail(`Backup file does not contain a non-empty JSON array of rows: ${backupPath}`);
  }
  process.stdout.write(`✓ Backup verified: ${backupPath} (${backupRows.length} rows)\n`);
}

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });

/** Given all rows, compute the ids to delete per the two criteria. Pure — testable by inspection. */
function computeDeletions(rows) {
  const toDelete = [];

  // (a) sgharlow/skillcrossroads test-fixture rows.
  for (const r of rows) {
    if (r.owner === "sgharlow" && r.repo === "skillcrossroads" && r.path && r.path.includes("test/fixtures")) {
      toDelete.push(r);
    }
  }

  // (b) sgharlow/info-worker-demo — keep exactly 2 representatives (highest overall,
  // distinct names; ties broken by name ascending for determinism).
  const demo = rows.filter((r) => r.owner === "sgharlow" && r.repo === "info-worker-demo");
  const seenNames = new Set();
  const keep = new Set();
  const sorted = [...demo].sort((a, b) => Number(b.overall) - Number(a.overall) || a.name.localeCompare(b.name));
  for (const r of sorted) {
    if (keep.size >= 2) break;
    if (seenNames.has(r.name)) continue;
    seenNames.add(r.name);
    keep.add(r.id);
  }
  for (const r of demo) {
    if (!keep.has(r.id)) toDelete.push(r);
  }

  return toDelete;
}

async function main() {
  const { rows } = await pool.query(
    "SELECT id, owner, repo, path, name, grade, overall::float8 AS overall FROM gallery_entries ORDER BY id",
  );
  process.stdout.write(`\nLoaded ${rows.length} rows from gallery_entries.\n\n`);

  const toDelete = computeDeletions(rows);

  if (toDelete.length === 0) {
    process.stdout.write("Nothing matches the delete criteria. Nothing to do.\n\n");
    return;
  }

  process.stdout.write(`Rows matching delete criteria (${toDelete.length}):\n`);
  for (const r of toDelete) {
    process.stdout.write(`  - ${r.id}  [${r.owner}/${r.repo}]  grade=${r.grade} overall=${r.overall}\n`);
  }

  if (!apply) {
    process.stdout.write(
      `\nDRY RUN — nothing deleted. Re-run with --apply --backup=<path> to delete these ${toDelete.length} rows.\n\n`,
    );
    return;
  }

  process.stdout.write("\nDeleting…\n");
  const ids = toDelete.map((r) => r.id);
  const result = await pool.query("DELETE FROM gallery_entries WHERE id = ANY($1::text[])", [ids]);
  process.stdout.write(`\n✓ Deleted ${result.rowCount} rows from gallery_entries.\n\n`);
}

main()
  .catch((err) => fail(`Error: ${err instanceof Error ? err.message : String(err)}`))
  .finally(() => pool.end());
