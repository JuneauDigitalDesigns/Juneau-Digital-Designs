/**
 * The short payment link. A dead link used to be a bare text response, which reads as a broken
 * site to a client mid-purchase (Xander, 2026-11-09). It is now the site's own page, still a 404,
 * and still the same for every kind of miss, so a code reveals nothing about the order.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PAY_CODE, payLinkTarget } from "../app/lib/pay-link.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const live = { status: "awaiting-payment", payment: { shortCode: "ABC234", checkoutUrl: "https://checkout.stripe.com/x" } };

test("only the order's current code, while it awaits payment, goes to Stripe", () => {
    assert.equal(payLinkTarget(live, "ABC234"), "https://checkout.stripe.com/x");
    assert.equal(payLinkTarget(live, "ZZZ999"), null, "a replaced code");
    assert.equal(payLinkTarget(null, "ABC234"), null, "unknown");
    for (const status of ["paid", "fulfilled", "cancelled", "expired"]) {
        assert.equal(payLinkTarget({ ...live, status }, "ABC234"), null, status);
    }
    assert.equal(payLinkTarget({ status: "awaiting-payment", payment: { shortCode: "ABC234" } }, "ABC234"), null);
    assert.equal(PAY_CODE.test("../../x"), false);
});

test("every miss is the one branded 404, with a way to reach us and no reason given", () => {
    assert.equal(existsSync(new URL("../app/pay/[code]/route.ts", import.meta.url)), false, "the text response is gone");
    const page = read("../app/pay/[code]/page.tsx");
    assert.match(page, /if \(!url\) notFound\(\);/);
    assert.equal(page.match(/notFound\(\)/g).length, 1, "one path for every kind of miss");

    const notFoundPage = read("../app/pay/[code]/not-found.tsx");
    assert.match(notFoundPage, /<LinkInactive \/>/);
    const inactive = read("../app/components/agreement/LinkInactive.tsx");
    assert.match(inactive, /Link inactive/);
    assert.match(inactive, /CONTACT_EMAIL/);
    assert.doesNotMatch(inactive, /paid|cancel|expired/i);
});
