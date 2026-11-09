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
const { getLead, listLeads, markLeadRead, recordLead } = await import("../app/lib/portal-leads.ts");

const TOKEN = "t".repeat(64);
const OTHER_TOKEN = "o".repeat(64);
const ACCT = "acct_1";
const SLUG = "acme-plumbing";

const kv = new Map();
const zsets = new Map();
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

function upstash(command) {
    const [op, ...args] = command;
    switch (op.toLowerCase()) {
        case "get": {
            if (args[0].includes(TOKEN)) return b64(JSON.stringify({ acctScope: ACCT, slug: SLUG }));
            if (args[0].includes(OTHER_TOKEN)) {
                return b64(JSON.stringify({ acctScope: "acct_2", slug: "other-site" }));
            }
            return kv.has(args[0]) ? b64(kv.get(args[0])) : null;
        }
        case "mget":
            return args.map((k) => (kv.has(k) ? b64(kv.get(k)) : null));
        case "set":
            kv.set(args[0], args[1]);
            return "OK";
        case "zadd": {
            const set = zsets.get(args[0]) ?? [];
            set.push(args[2]);
            zsets.set(args[0], set);
            return 1;
        }
        case "zrange":
            return (zsets.get(args[0]) ?? []).map(b64);
        case "expire":
            return 1;
        // @upstash/ratelimit's fixed-window script: [count so far, ms until reset].
        case "evalsha":
        case "eval":
            return [1, 60_000];
        default:
            throw new Error(`fake upstash: unhandled ${op}`);
    }
}

const realFetch = globalThis.fetch;

beforeEach(() => {
    kv.clear();
    zsets.clear();
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (!url.startsWith(KV_URL)) throw new Error(`unexpected fetch: ${url}`);
        const body = JSON.parse(init.body);
        return url.endsWith("/pipeline")
            ? Response.json(body.map((cmd) => ({ result: upstash(cmd) })))
            : Response.json({ result: upstash(body) });
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

const seedLead = (message = null) =>
    recordLead({ acctScope: ACCT, slug: SLUG, name: "Dana", phoneRaw: "4075550188", message });

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
    const lead = await seedLead();
    for (let i = 0; i < 3; i += 1) await send({ leadId: lead.leadId, message: "x".repeat(1500) });
    assert.equal((await getLead(ACCT, SLUG, lead.leadId)).message.length, 2000);
});

test("one site's token can't reach another site's lead", async () => {
    const lead = await seedLead();
    const res = await send({ leadId: lead.leadId, message: "hello" }, OTHER_TOKEN);
    assert.equal(res.status, 404);
    assert.equal((await getLead(ACCT, SLUG, lead.leadId)).message, null);
});

test("an unknown token is refused, and a missing lead is a 404 the form can report", async () => {
    const lead = await seedLead();
    assert.equal((await send({ leadId: lead.leadId, message: "hi" }, "x".repeat(64))).status, 401);
    assert.equal((await send({ leadId: "nope", message: "hi" })).status, 404);
    assert.equal((await send({ leadId: lead.leadId, message: "  " })).status, 400);
});
