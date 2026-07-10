import { hasDb, getPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — the dead-man's-switch probe target.
 *
 * Semantics follow the repo's env-gated design: with no DATABASE_URL the in-memory fallbacks are
 * the expected mode, so the DB reports "not-configured" and health stays 200. When a DB IS
 * configured (production), an unreachable DB means Pro entitlements, gallery opt-ins, and scan
 * history are silently not persisting — exactly the failure class that must alarm — so health
 * goes 503 (fail LOUD, never a green page over a dead dependency).
 */
export async function GET(): Promise<Response> {
  let db: "ok" | "error" | "not-configured" = "not-configured";
  if (hasDb()) {
    try {
      // Bounded probe: a hung pool must not make the health check itself hang past the monitor.
      await Promise.race([
        getPool().query("select 1"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("db probe timeout")), 2500)),
      ]);
      db = "ok";
    } catch {
      db = "error";
    }
  }
  const ok = db !== "error";
  return Response.json(
    { ok, db, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
