import { readFileSync } from "node:fs";
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
    // Managed providers need TLS. Prefer strict verification: if a CA is provided (DATABASE_SSL_CA,
    // PEM or a file path) verify against it; otherwise providers like Neon/Supabase present certs a
    // default Node trust store may not chain, so fall back to encrypted-but-unverified (documented).
    const ca = process.env.DATABASE_SSL_CA;
    const ssl = local
      ? false
      : ca
        ? { ca: ca.includes("BEGIN") ? ca : readFileSync(ca, "utf8"), rejectUnauthorized: true }
        : { rejectUnauthorized: false };
    pool = new Pool({ connectionString, ssl, max: 5 });
  }
  return pool;
}
