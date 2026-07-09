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

/** Process-wide singleton (in-memory in v0.1). */
export const entitlements: Entitlements = createMemoryEntitlements();
