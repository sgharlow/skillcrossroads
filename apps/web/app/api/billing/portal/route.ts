import { getStripe } from "@/lib/stripe";
import { readSession } from "@/lib/session";
import { entitlements } from "@/lib/entitlements";

export const runtime = "nodejs";

/**
 * POST /api/billing/portal — open the Stripe Customer Portal for the signed-in user.
 *
 * The portal (hosted by Stripe) is where a customer cancels, resumes, updates their payment
 * method, and downloads invoices — so we never build or touch any of that ourselves, and no card
 * data ever reaches this app. We only need the stored Stripe customer id (`customerFor`), which
 * the checkout webhook records. A user who never subscribed has no customer → send them to pricing.
 */
export async function POST(req: Request): Promise<Response> {
  const stripe = getStripe();
  if (!stripe) {
    return Response.json(
      { error: "Stripe is not configured.", needed: ["STRIPE_SECRET_KEY"] },
      { status: 501 },
    );
  }

  const session = readSession(req);
  if (!session.login) {
    return Response.json({ error: "Sign in with GitHub first.", signIn: "/api/auth/github" }, { status: 401 });
  }

  const origin = new URL(req.url).origin;
  const customer = await entitlements.customerFor(session.login);
  if (!customer) {
    // Nothing to manage — this user has never checked out. Point them at the plans.
    return Response.redirect(`${origin}/pricing`, 303);
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/account`,
    });
    return Response.redirect(portal.url, 303);
  } catch (err) {
    // The most common cause is the portal not being activated once in the Stripe dashboard.
    return Response.json(
      {
        error: "The Stripe customer portal isn't available yet.",
        note: "Activate it once at https://dashboard.stripe.com/settings/billing/portal, then this button works.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 501 },
    );
  }
}
