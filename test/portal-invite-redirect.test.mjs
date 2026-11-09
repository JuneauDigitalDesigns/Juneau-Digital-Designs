/**
 * Where a Clerk portal invitation sends a client closed on a call.
 *
 * It pointed at `/portal/onboarding`, a protected route. An invitee has no session, so the
 * middleware sent them to sign-in, and sign-in couldn't find an account: on 2026-11-08 a phone
 * close stopped there, with the invitation still pending and no Clerk user. On that code the
 * first test fails.
 *
 * This proves the route and the redirect chain. Whether Clerk's own sign-up form consumes the
 * ticket can only be proved by accepting a real invite.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);
register("./clerk-unreachable-hook.mjs", import.meta.url);

const { invitationRedirect } = await import("../app/lib/portal-invite.ts");
const { safeRedirectPath } = await import("../app/lib/safe-redirect.ts");
const { postAuthRedirect } = await import("../app/lib/post-auth-redirect.ts");

test("an invitation lands on the sign-up page, which a signed-out client can reach", () => {
    const url = new URL(invitationRedirect("arthurs-plumbing"));
    assert.equal(url.pathname, "/portal/sign-up");

    const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
    const excluded = proxy.slice(proxy.indexOf("isAuthRoute = createRouteMatcher"), proxy.indexOf("export default"));
    assert.match(excluded, /"\/portal\/sign-up\(\.\*\)"/, "the middleware must not protect where the invitation lands");
});

test("after sign-up the client still reaches this site's onboarding", () => {
    const url = new URL(invitationRedirect("arthurs-plumbing"));
    const target = url.searchParams.get("redirect_url");
    assert.equal(target, "/portal/onboarding?site=arthurs-plumbing");
    // The sign-up page runs it through both of these.
    assert.equal(safeRedirectPath(target), target, "the open-redirect guard keeps it");
    assert.equal(postAuthRedirect(safeRedirectPath(target)), target, "and the site query survives");
});

test("an unusual site id can't break out of the redirect", () => {
    const url = new URL(invitationRedirect("a&b=c d"));
    assert.equal(url.searchParams.get("redirect_url"), "/portal/onboarding?site=a%26b%3Dc%20d");
    assert.equal([...url.searchParams.keys()].join(), "redirect_url");
});
