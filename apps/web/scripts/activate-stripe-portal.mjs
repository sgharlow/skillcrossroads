/**
 * activate-stripe-portal.mjs — one-time setup for the Stripe Customer Portal that
 * /api/billing/portal opens (the "Manage billing / cancel" button on /account).
 *
 * You run this yourself so the secret key stays in YOUR environment and never appears in chat.
 *
 *   # dry run (default — shows what it will do, creates nothing):
 *   node --env-file=apps/web/.env.local apps/web/scripts/activate-stripe-portal.mjs
 *   #   ...or set the key in your shell first, then:
 *   node apps/web/scripts/activate-stripe-portal.mjs
 *
 *   # actually create the portal configuration:
 *   node --env-file=apps/web/.env.local apps/web/scripts/activate-stripe-portal.mjs --apply
 *
 * Safety: dry-run by default; refuses to run twice (reports the existing active config); never
 * prints the key. Enables cancel + update-payment-method + invoice history. This is a change to
 * LIVE payment-provider configuration when run with a live key — that's the intent, but --apply
 * is required to commit it.
 */
import Stripe from "stripe";

const apply = process.argv.includes("--apply");
const key = process.env.STRIPE_SECRET_KEY;

function fail(msg) {
  process.stderr.write(`\n✗ ${msg}\n\n`);
  process.exit(1);
}

if (!key) {
  fail(
    "STRIPE_SECRET_KEY is not set.\n" +
      "  Pass it via your env, e.g.:  node --env-file=apps/web/.env.local apps/web/scripts/activate-stripe-portal.mjs\n" +
      "  (The key is read from your environment and is never printed.)",
  );
}

const mode = key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "LIVE" : "TEST";
const stripe = new Stripe(key);

const FEATURES = {
  subscription_cancel: { enabled: true, mode: "at_period_end", proration_behavior: "none" },
  payment_method_update: { enabled: true },
  invoice_history: { enabled: true },
};
const RETURN_URL = process.env.SC_PORTAL_RETURN_URL ?? "https://skillcrossroads.com/account";

async function main() {
  process.stdout.write(`\nStripe Customer Portal setup — ${mode} mode\n`);

  // Idempotency: if an active configuration already exists, the portal already works — don't add a duplicate.
  const existing = await stripe.billingPortal.configurations.list({ limit: 10 });
  const active = existing.data.find((c) => c.active);
  if (active) {
    process.stdout.write(
      `\n✓ A portal configuration already exists and is active:  ${active.id}\n` +
        `  The "Manage billing / cancel" button already works. Nothing to do.\n` +
        `  (To change what it allows, edit it at https://dashboard.stripe.com/settings/billing/portal)\n\n`,
    );
    return;
  }

  process.stdout.write(
    "\n  Will enable:\n" +
      "    • Cancel subscription (at period end)\n" +
      "    • Update payment method\n" +
      "    • Invoice history\n" +
      `  Return URL: ${RETURN_URL}\n`,
  );

  if (!apply) {
    process.stdout.write(
      `\n  DRY RUN — nothing created. Re-run with --apply to create it${mode === "LIVE" ? " on the LIVE account" : ""}.\n\n`,
    );
    return;
  }

  process.stdout.write("\n  Creating configuration…\n");
  const cfg = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Skill Crossroads — manage your subscription" },
    default_return_url: RETURN_URL,
    features: FEATURES,
  });
  process.stdout.write(
    `\n✓ Created and set as default:  ${cfg.id}  (active: ${cfg.active})\n` +
      `  /account → "Manage billing / cancel" now opens the live portal.\n\n`,
  );
}

main().catch((err) => fail(`Stripe API error: ${err?.message ?? String(err)}`));
