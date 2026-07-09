import Stripe from "stripe";

/**
 * Stripe client, gated on STRIPE_SECRET_KEY (prefer a restricted key, `rk_`). Returns null when
 * unconfigured so routes can respond with a clean 501 instead of throwing. The SDK uses its
 * pinned default API version.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

/** The Pro subscription Price id (created in the Stripe dashboard). */
export function proPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_ID;
}
