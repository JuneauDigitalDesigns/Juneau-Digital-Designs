import "server-only";
import Stripe from "stripe";

/**
 * Lazily-constructed Stripe client.
 *
 * The key check and `new Stripe()` used to run at module load. That is fine at runtime, but
 * `next build` imports every route module during its "Collecting page data" phase — including
 * the API routes that import this file — purely to read their metadata, and that import
 * evaluated this module and threw when `STRIPE_SECRET_KEY` wasn't in the *build* environment.
 * A secret needed only to serve a request should never be a build-time requirement.
 *
 * Deferring construction to first property access moves the requirement back to where it
 * belongs: the first time a handler actually touches `stripe` at runtime. Build-time page-data
 * collection never accesses it, so it never constructs and never throws.
 */
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

// A Proxy so existing `import { stripe }` call sites keep working unchanged: every property
// access forwards to the real client, constructing it on first touch. Functions are bound to
// the real client so a call like `stripe.webhooks` (a resource object) or any top-level method
// can never end up with `this` pointing back at the proxy.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
