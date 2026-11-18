/**
 * The owner's text at the end of the homepage's receptionist film (2026-11-18).
 *
 * The film must never show a nicer text than an owner gets. So it is held, line for line, to what
 * the real builders produce for the same lead: the replacement (v2) campaign's post-call text for
 * the Starter call, and its new-lead text for the Growth web form, each with a link.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);

Object.assign(process.env, {
    KV_REST_API_URL: "https://kv.test.invalid",
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: "https://kv.test.invalid",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});

const { callBriefBodyV2 } = await import("../app/lib/call-brief.ts");
const { leadAlertBodyV2 } = await import("../app/lib/lead-alert.ts");
const { ownerLinkUrl, OWNER_LINK_ID } = await import("../app/lib/owner-links.ts");
const { FILM_OWNER_LINK, FILM_OWNER_TEXT, FILM_CALL, FILM_CALL_IN } = await import("../app/data/switchboard-calls.ts");

test("the example link is in the real format: our domain, an opaque 8-character id", () => {
    const id = FILM_OWNER_LINK.split("/").pop();
    assert.match(id, OWNER_LINK_ID);
    assert.equal(FILM_OWNER_LINK, ownerLinkUrl(id));
});

test("the Starter call ends on the real v2 post-call text, line for line", () => {
    assert.equal(
        FILM_OWNER_TEXT.starter.join("\n"),
        callBriefBodyV2({ callerName: FILM_CALL_IN.caller.name, priority: "emergency" }, FILM_OWNER_LINK),
    );
});

test("the Growth web form ends on the real v2 new-lead text, line for line", () => {
    assert.equal(FILM_OWNER_TEXT.growth.join("\n"), leadAlertBodyV2(FILM_CALL.caller.name, FILM_OWNER_LINK));
});

test("both texts keep the STOP and HELP line", () => {
    for (const lines of Object.values(FILM_OWNER_TEXT)) assert.match(lines[lines.length - 1], /Reply STOP to opt out, HELP for help$/);
});
