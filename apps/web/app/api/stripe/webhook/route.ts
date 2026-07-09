import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { entitlements } from "@/lib/entitlements";

export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook — Stripe events. Verifies the signature, then flips Pro entitlement
 * on subscription start/stop. Requires STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request): Promise<Response> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return Response.json({ error: "Stripe webhook not configured." }, { status: 501 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (err) {
    return new Response(`Invalid signature: ${err instanceof Error ? err.message : "error"}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const login = s.client_reference_id ?? undefined;
      const customer = typeof s.customer === "string" ? s.customer : s.customer?.id;
      if (login) await entitlements.setPro(login, true, customer);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const login = await entitlements.loginForCustomer(customer);
      if (login) await entitlements.setPro(login, false, customer);
      break;
    }
    default:
      break;
  }

  return Response.json({ received: true });
}
