import { hasDb, getPool } from "./db";

/**
 * Pro entitlement store. Maps a GitHub login to its Pro status and Stripe customer id.
 *
 * The in-memory implementation is per-instance (resets on restart) — fine for local proof. The
 * production backing is Postgres (Neon/Supabase, Build Bible §4.4); swapping is a one-file change
 * because every consumer depends only on this interface.
 */
export interface Entitlements {
  isPro(login: string): Promise<boolean>;
  setPro(login: string, pro: boolean, customerId?: string): Promise<void>;
  customerFor(login: string): Promise<string | undefined>;
  loginForCustomer(customerId: string): Promise<string | undefined>;
}

interface Record {
  pro: boolean;
  customerId?: string;
}

export function createMemoryEntitlements(): Entitlements {
  const byLogin = new Map<string, Record>();
  return {
    isPro: (login) => Promise.resolve(byLogin.get(login)?.pro ?? false),
    setPro: (login, pro, customerId) => {
      const prev = byLogin.get(login) ?? { pro: false };
      byLogin.set(login, { pro, customerId: customerId ?? prev.customerId });
      return Promise.resolve();
    },
    customerFor: (login) => Promise.resolve(byLogin.get(login)?.customerId),
    loginForCustomer: (customerId) => {
      for (const [login, rec] of byLogin) if (rec.customerId === customerId) return Promise.resolve(login);
      return Promise.resolve(undefined);
    },
  };
}

/** Postgres-backed entitlements (production). */
export function createPgEntitlements(pool: import("pg").Pool): Entitlements {
  return {
    async isPro(login) {
      const r = await pool.query("SELECT pro FROM subscriptions WHERE login=$1", [login]);
      return r.rows[0]?.pro ?? false;
    },
    async setPro(login, pro, customerId) {
      await pool.query(
        `INSERT INTO subscriptions (login, pro, stripe_customer_id, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (login) DO UPDATE
           SET pro = $2,
               stripe_customer_id = COALESCE($3, subscriptions.stripe_customer_id),
               updated_at = now()`,
        [login, pro, customerId ?? null],
      );
    },
    async customerFor(login) {
      const r = await pool.query("SELECT stripe_customer_id FROM subscriptions WHERE login=$1", [login]);
      return r.rows[0]?.stripe_customer_id ?? undefined;
    },
    async loginForCustomer(customerId) {
      const r = await pool.query("SELECT login FROM subscriptions WHERE stripe_customer_id=$1", [customerId]);
      return r.rows[0]?.login ?? undefined;
    },
  };
}

/** Process-wide singleton — Postgres when DATABASE_URL is set, else in-memory. */
export const entitlements: Entitlements = hasDb() ? createPgEntitlements(getPool()) : createMemoryEntitlements();
