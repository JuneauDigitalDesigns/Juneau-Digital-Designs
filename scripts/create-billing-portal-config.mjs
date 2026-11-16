#!/usr/bin/env node
/**
 * Makes the Stripe Billing Portal configuration the portal's "Update card" button uses (Q4,
 * approved 2026-11-16), and prints its id for `STRIPE_BILLING_PORTAL_CONFIG_ID`.
 *
 * Only "update payment method" is switched on. Cancelling, plan switching, invoice history and
 * customer details are all off: the portal has its own cancel flow (its records, both emails and
 * the console's signal), and plan changes go through signed agreements.
 *
 * Writes one object to whichever Stripe account the key belongs to, so:
 *   - test mode first:   STRIPE_SECRET_KEY=sk_test_… node scripts/create-billing-portal-config.mjs
 *   - live only with Xander's explicit OK.
 * It refuses a live key unless `--live` is passed.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
    console.error("STRIPE_SECRET_KEY is not set.");
    process.exit(1);
}
const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");
if (live && !process.argv.includes("--live")) {
    console.error("That is a live key. Pass --live only with Xander's explicit OK.");
    process.exit(1);
}

const stripe = new Stripe(key);
const config = await stripe.billingPortal.configurations.create({
    name: "JDD portal: update card only",
    business_profile: { headline: "Juneau Digital Designs: change the card for your subscription" },
    features: {
        payment_method_update: { enabled: true },
        customer_update: { enabled: false },
        invoice_history: { enabled: false },
        subscription_cancel: { enabled: false },
        subscription_update: { enabled: false },
    },
    metadata: { purpose: "portal-update-card" },
});

console.log(`${live ? "LIVE" : "test"} configuration created.`);
console.log(`STRIPE_BILLING_PORTAL_CONFIG_ID=${config.id}`);
