/**
 * The public Terms of Service page (`/terms`).
 *
 * Stripe Checkout's `consent_collection.terms_of_service: "required"` links the buyer to the
 * Terms of Service URL in Stripe's public details. Before this page the agency had none a
 * signed-out buyer could open (`/agreement` sends them to `/start`), so the box a client ticks on
 * Stripe's page pointed at nothing they could read.
 *
 * Node 22.0 cannot import the TypeScript page, so these read the source: what matters is that the
 * route exists outside every Clerk-protected matcher, and that it renders and hashes the terms
 * through the same functions the agreement and the operator close record. On the code before
 * this change, both tests fail — there is no `app/terms/page.tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const PAGE = root("app/terms/page.tsx");

/** The matchers `proxy.ts` hands to `createRouteMatcher`, as RegExps the way Clerk reads them. */
function protectedMatchers() {
  const src = readFileSync(root("proxy.ts"), "utf8");
  const m = /isPortalRoute\s*=\s*createRouteMatcher\(\[([^\]]*)\]/.exec(src);
  assert.ok(m, "proxy.ts no longer declares isPortalRoute the way this test expects");
  return [...m[1].matchAll(/"([^"]+)"/g)].map(([, p]) => new RegExp(`^${p}$`));
}

test("/terms exists and is public, signed out", () => {
  assert.ok(existsSync(PAGE), "app/terms/page.tsx is missing");
  const matchers = protectedMatchers();
  for (const path of ["/terms", "/terms?plan=growth"]) {
    const pathname = path.split("?")[0];
    assert.equal(matchers.some((re) => re.test(pathname)), false, `${pathname} is behind Clerk`);
  }
  // The portal is still protected, so the parsing above is actually reading the matcher.
  assert.equal(matchers.some((re) => re.test("/portal/billing")), true);
  // No auth call of its own either.
  assert.doesNotMatch(readFileSync(PAGE, "utf8"), /from "@clerk\/nextjs\/server"|auth\(\)/);
});

test("/terms shows the version and hash the checkout records, from the same source", () => {
  const page = readFileSync(PAGE, "utf8");
  // The words: the one resolver the agreement page and the PDF render from.
  assert.match(page, /getTermsForPlan\(doc\.plan, \{ webOnly: doc\.webOnly \}\)/);
  // The hash: the function /api/agreement and the operator close both store as audit.termsHash.
  assert.match(page, /hashTermsForPlan\(doc\.plan, \{ webOnly: doc\.webOnly \}\)/);
  assert.match(readFileSync(root("app/api/agreement/route.ts"), "utf8"), /hashTermsForPlan\(/);
  assert.match(readFileSync(root("app/lib/verbal-agreement.ts"), "utf8"), /hashTermsForPlan\(/);
  // Both are printed, so a reader (or Stripe's reviewer) can match the page to a record.
  assert.match(page, /data-terms-version=\{version\}/);
  assert.match(page, /data-terms-hash=\{hash\}/);
});

test("website checkout asks for the terms tick above Subscribe, as the operator payment link does", () => {
    // Found in Xander's self-serve test, 2026-11-09: the link had it and website checkout did not.
    for (const file of ["app/api/checkout/route.ts", "app/lib/order-checkout.ts"]) {
        assert.match(readFileSync(root(file), "utf8"), /consent_collection: \{ terms_of_service: "required" \}/, file);
    }
});
