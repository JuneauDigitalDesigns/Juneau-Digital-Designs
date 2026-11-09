/**
 * What to tell the operator when Stripe won't open a payment link. Pure, so the test runs it.
 *
 * Operator links require the client to tick the Terms of Service box on Stripe's page
 * (`consent_collection.terms_of_service`), and Stripe refuses to create the session when the
 * account has no Terms of service URL in its public details. That surfaced in the wizard as a
 * bare "Could not open a payment link", with nothing to act on: found in the 2026-11-08 test run.
 *
 * @param {{ type?: string, param?: string, message?: string } | null | undefined} err
 * @returns {{ code: string, message: string } | null} null when it isn't Stripe refusing.
 */
export function checkoutRefusal(err) {
  if (!/^Stripe/.test(err?.type ?? "")) return null;
  if (/terms of service/i.test(err?.message ?? "") || /consent_collection/.test(err?.param ?? "")) {
    return {
      code: "no-tos-url",
      message:
        "Stripe refused the payment link because this Stripe account has no Terms of service URL. Add one in Stripe under Settings, Public details, then try again.",
    };
  }
  return { code: "stripe-refused", message: `Stripe refused the payment link: ${err?.message ?? "no reason given"}` };
}
