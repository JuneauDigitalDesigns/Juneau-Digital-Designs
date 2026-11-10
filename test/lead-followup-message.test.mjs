/**
 * The message box a visitor gets when an AI callback couldn't be placed.
 *
 * The lead is already in the inbox by then, and the owner already texted. So the message has to
 * land on that lead: a second lead would show one enquiry twice and text the owner twice.
 *
 * The real route and store. The network is the only double: an in-memory Upstash on `fetch`.
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});

const { POST } = await import("../app/api/ingest/lead/message/route.ts");
const { getLead, listLeads, markLeadRead, recordLeadOnce } = await import("../app/lib/portal-leads.ts");

const TOKEN = "t".repeat(64);
const OTHER_TOKEN = "o".repeat(64);
const ACCT = "acct_1";
const SLUG = "acme-plumbing";

const redis = fakeUpstash({
    url: KV_URL,
    resolve: (key) => {
        if (key.includes(TOKEN)) return { acctScope: ACCT, slug: SLUG };
        if (key.includes(OTHER_TOKEN)) return { acctScope: "acct_2", slug: "other-site" };
        return undefined;
    },
});

const realFetch = globalThis.fetch;

beforeEach(() => {
    redis.reset();
    globalThis.fetch = async (input, init = {}) => {
        if (!redis.owns(input)) throw new Error(`unexpected fetch: ${input}`);
        return redis.handle(input, init);
    };
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

const send = (body, token = TOKEN) =>
    POST(
        new Request("https://www.juneaudigitaldesigns.com/api/ingest/lead/message", {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        }),
    );

/** A lead as the ingest records it: which also opens that submission's one follow-up. */
const seedLead = async (message = null) =>
    (await recordLeadOnce({ acctScope: ACCT, slug: SLUG, name: "Dana", phoneRaw: "4075550188", message })).lead;

test("the message lands on the existing lead, so the inbox still shows one enquiry", async () => {
    const lead = await seedLead();
    const res = await send({ leadId: lead.leadId, message: " Leak under the sink " });

    assert.equal(res.status, 200);
    const leads = await listLeads(ACCT, SLUG);
    assert.equal(leads.length, 1, "no second lead");
    assert.equal(leads[0].message, "Leak under the sink");
    assert.equal(leads[0].name, "Dana");
});

test("words the visitor already typed on the form are kept", async () => {
    const lead = await seedLead("Need a quote");
    await send({ leadId: lead.leadId, message: "Leak under the sink" });
    assert.equal(
        (await getLead(ACCT, SLUG, lead.leadId)).message,
        "Need a quote\n\nLeak under the sink",
    );
});

test("a message arriving after the owner opened the lead makes it unread again", async () => {
    const lead = await seedLead();
    await markLeadRead(ACCT, SLUG, lead.leadId);
    await send({ leadId: lead.leadId, message: "One more thing" });
    assert.equal((await getLead(ACCT, SLUG, lead.leadId)).readAt, null);
});

test("repeating the request can't grow a lead past the cap", async () => {
    // One message per submission now (lead-gate.test.mjs), so growth needs resubmitting the
    // form; each resubmission joins this lead and opens one more message.
    const lead = await seedLead();
    for (let i = 0; i < 3; i += 1) {
        await send({ leadId: lead.leadId, message: `${i}`.repeat(1500) });
        await seedLead();
    }
    assert.equal((await getLead(ACCT, SLUG, lead.leadId)).message.length, 2000);
});

test("one site's token can't reach another site's lead", async () => {
    const lead = await seedLead();
    const res = await send({ leadId: lead.leadId, message: "hello" }, OTHER_TOKEN);
    assert.equal(res.status, 409, "the other site has no open message for this id");
    assert.equal((await getLead(ACCT, SLUG, lead.leadId)).message, null);
});

test("an unknown token is refused, and a lead with no open message is a refusal the form can report", async () => {
    const lead = await seedLead();
    assert.equal((await send({ leadId: lead.leadId, message: "hi" }, "x".repeat(64))).status, 401);
    assert.equal((await send({ leadId: "nope", message: "hi" })).status, 409);
    assert.equal((await send({ leadId: lead.leadId, message: "  " })).status, 400);
});
