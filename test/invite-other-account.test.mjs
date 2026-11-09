/**
 * A portal invitation opened in a browser signed in to a different account. Clerk's sign-up form
 * sent that visitor on to the invited account's onboarding, which 404s for them, with the
 * invitation unused (test run, 2026-11-09). On that code the import below fails.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inviteNeedsSignOut, inviteReturnPath } from "../app/lib/invite-return.mjs";

test("only a signed-in visitor holding an invitation is stopped", () => {
    assert.equal(inviteNeedsSignOut("user_1", "ticket"), true);
    assert.equal(inviteNeedsSignOut(null, "ticket"), false, "the normal invitee");
    assert.equal(inviteNeedsSignOut("user_1", undefined), false, "an ordinary signed-in visitor");
    assert.equal(inviteNeedsSignOut("user_1", ["a", "b"]), false);
});

test("signing out returns to the invitation with its ticket and destination", () => {
    const path = inviteReturnPath({ redirect_url: "/portal/onboarding?site=a", __clerk_ticket: "t.k", __clerk_status: "sign_up", other: "x" });
    const url = new URL(path, "https://x.test");
    assert.equal(url.pathname, "/portal/sign-up");
    assert.equal(url.searchParams.get("__clerk_ticket"), "t.k");
    assert.equal(url.searchParams.get("redirect_url"), "/portal/onboarding?site=a");
    assert.equal(url.searchParams.get("other"), null);
});

test("the sign-up page checks before Clerk's form can redirect", () => {
    const page = readFileSync(new URL("../app/portal/sign-up/[[...sign-up]]/page.tsx", import.meta.url), "utf8");
    assert.ok(page.indexOf("inviteNeedsSignOut(userId") < page.indexOf("<SignUp"));
    assert.match(page, /<InviteOtherAccount/);
});
