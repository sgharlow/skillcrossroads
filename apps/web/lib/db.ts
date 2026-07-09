import { Pool } from "pg";

let pool: Pool | undefined;

/** True when a Postgres backing is configured. */
export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Lazily-created shared connection pool. Local Postgres uses no SSL; managed providers
 * (Neon, Supabase, Vercel Postgres) require it — inferred from the host.
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}
