import { getStripe, proPriceId } from "@/lib/stripe";
import { readSession, trustLogin } from "@/lib/session";

export const runtime = "nodejs";

/**
 * POST /api/checkout — start a Skill Crossroads Pro subscription checkout.
 * Gated on STRIPE_SECRET_KEY + STRIPE_PRICE_ID; returns 501 (not 500) until configured.
 */
export async function POST(req: Request): Promise<Response> {
  const stripe = getStripe();
  const price = proPriceId();
  if (!stripe || !price) {
    return Response.json(
      {
        error: "Stripe is not configured.",
        needed: ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"],
        note: "Create a Pro Price in Stripe, then set these env vars (prefer a restricted key).",
      },
      { status: 501 },
    );
  }

  // Require a verified GitHub identity: the webhook flips Pro on client_reference_id, so a signed-out
  // (or forgeable) checkout would charge the card (after the trial) and never grant Pro — or attribute
  // it to the wrong login. Fail before creating it. Billing = privilege at stake.
  const login = trustLogin(readSession(req).login, true);
  if (!login) {
    return Response.json(
      { error: "Sign in with GitHub before subscribing.", signIn: "/api/auth/github" },
      { status: 401 },
    );
  }
  const origin = new URL(req.url).origin;

  // No payment_method_types — Stripe picks eligible methods dynamically (best-practice).
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: login, // links the GitHub user for the webhook
    subscription_data: { trial_period_days: 14 },
    allow_promotion_codes: true,
    success_url: `${origin}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
  });

  return Response.json({ url: checkout.url });
}
