/**
 * Links in the owner's texts, switched OFF until Twilio re-vets the campaign.
 *
 * JDD's ACCOUNT_NOTIFICATION campaign is registered `has_embedded_links: false`. A text with a
 * link before that changes is undeclared campaign content — what carriers filter. So the switch
 * (`OWNER_TEXT_LINKS=on`) must be the ONLY way a link goes out, flag-off texts must be today's
 * byte for byte, and flag-on texts must be the samples submitted to Twilio
 * (jdd-ops/TWILIO-SUPPORT-campaign-update.md) byte for byte, since those are what get vetted.
 *
 * And `/portal/l/<id>` must open only for the account the link was made for: another account's
 * id, an unknown id and a malformed id all get one identical answer.
 *
 * Real implementations; the network is the only double, as in call-brief.test.mjs.
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./server-only-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
const OWNER_EMAIL = "arthur@arthursplumbing.com";
const OTHER_EMAIL = "someone@else.example";
const OWNER_PHONE = "+14075550123";
const SLUG = "arthurs-plumbing";
const REC = "recIrliSdvpruSVij"; // a real Airtable record id's shape (the fixture's answered call)

Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "test-auth",
    TWILIO_MESSAGING_SERVICE_SID: `MG${"m".repeat(32)}`,
    TWILIO_NOTIFICATION_NUMBER: "+16893292464",
});

const links = await import("../app/lib/owner-links.ts");
const { notifyOwnerOfLead } = await import("../app/lib/lead-alert.ts");
const { notifyOwnerOfCall } = await import("../app/lib/call-brief.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");

const ACCT = accountScope(OWNER_EMAIL);
const LINK = /https:\/\/www\.juneaudigitaldesigns\.com\/portal\/l\/([A-Za-z0-9]{8})/;

/* ── network doubles ──────────────────────────────────────────────────────── */

const kv = new Map();
let twilioCalls = [];
let kvSetFails = false;
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

function upstash(command) {
    const [op, ...args] = command;
    switch (op.toLowerCase()) {
        case "get": {
            const v = kv.get(args[0]);
            return v === undefined ? null : b64(v);
        }
        case "set": {
            if (kvSetFails && String(args[0]).startsWith("portal:owner-link:")) throw new Error("kv down");
            const nx = args.slice(2).some((a) => String(a).toLowerCase() === "nx");
            if (nx && kv.has(args[0])) return null;
            kv.set(args[0], args[1]);
            return "OK";
        }
        case "del":
            return kv.delete(args[0]) ? 1 : 0;
        case "keys": {
            const re = new RegExp(`^${args[0].replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
            return [...kv.keys()].filter((k) => re.test(k)).map(b64);
        }
        default:
            throw new Error(`fake upstash: unhandled ${op}`);
    }
}

const realFetch = globalThis.fetch;
beforeEach(() => {
    kv.clear();
    twilioCalls = [];
    kvSetFails = false;
    delete process.env.OWNER_TEXT_LINKS;
    kv.set(`jdd:account:${OWNER_EMAIL}`, JSON.stringify({ email: OWNER_EMAIL }));
    kv.set(`sms:consent:account:${OWNER_EMAIL}`, OWNER_PHONE);
    kv.set(
        `sms:consent:state:${OWNER_PHONE}`,
        JSON.stringify({ phone: OWNER_PHONE, status: "granted", updatedAt: "2026-11-01T12:00:00.000Z", accountEmail: OWNER_EMAIL }),
    );
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.startsWith(KV_URL)) {
            const body = JSON.parse(init.body);
            try {
                return url.endsWith("/pipeline")
                    ? Response.json(body.map((cmd) => ({ result: upstash(cmd) })))
                    : Response.json({ result: upstash(body) });
            } catch (e) {
                return Response.json({ error: e.message }, { status: 500 });
            }
        }
        if (url.startsWith("https://api.twilio.com/")) {
            twilioCalls.push(Object.fromEntries(new URLSearchParams(String(init.body))));
            return Response.json({ sid: `SM${"s".repeat(32)}` });
        }
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.OWNER_TEXT_LINKS;
});

const lead = (over = {}) => ({ acctScope: ACCT, slug: SLUG, name: "Maria Lopez", leadId: "4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c", ...over });
const call = (over = {}) => ({
    acctScope: ACCT,
    slug: SLUG,
    callId: "call_e747643b230fc1417ce8d538d4c",
    callerName: "Santa Juno",
    priority: "callback",
    callerNumber: null,
    recordId: REC,
    ...over,
});
const linkKeys = () => [...kv.keys()].filter((k) => k.startsWith("portal:owner-link:"));
/** Swap the minted id for the sample's illustrative one, to compare with the registered sample. */
const asSample = (body, sampleId) => body.replace(LINK, `https://www.juneaudigitaldesigns.com/portal/l/${sampleId}`);
const TODAY_BRIEF = "JDD Notification Service\nName: Santa Juno\nPriority: Callback\nThe full lead is in your portal.";

/* ── switch OFF: today's texts, byte for byte, and no link minted ─────────── */

test("links off: the new-lead text is exactly today's", async () => {
    await notifyOwnerOfLead(lead());
    assert.equal(twilioCalls[0].Body, "New lead from Maria Lopez — open your portal.");
    assert.deepEqual(linkKeys(), []);
});

test("links off: the end-of-call brief is exactly today's", async () => {
    await notifyOwnerOfCall(call());
    assert.equal(twilioCalls[0].Body, TODAY_BRIEF);
    assert.deepEqual(linkKeys(), []);
});

for (const value of ["off", "true", "1", "ON", "yes", ""]) {
    test(`OWNER_TEXT_LINKS=${JSON.stringify(value)} is not on: only the exact value "on" adds a link`, async () => {
        process.env.OWNER_TEXT_LINKS = value;
        await notifyOwnerOfLead(lead());
        assert.doesNotMatch(twilioCalls[0].Body, LINK);
    });
}

/* ── switch ON: the registered samples, byte for byte ─────────────────────── */

test("links on: the new-lead text is the registered sample", async () => {
    process.env.OWNER_TEXT_LINKS = "on";
    await notifyOwnerOfLead(lead());
    assert.equal(
        asSample(twilioCalls[0].Body, "7Kq2Xw9P"),
        "JDD Notification Service\nNew lead from Maria Lopez.\nView it: https://www.juneaudigitaldesigns.com/portal/l/7Kq2Xw9P\nReply STOP to opt out, HELP for help",
    );
});

test("links on: the end-of-call brief is the registered sample", async () => {
    process.env.OWNER_TEXT_LINKS = "on";
    await notifyOwnerOfCall(call());
    assert.equal(
        asSample(twilioCalls[0].Body, "rB4mT8sZ"),
        "JDD Notification Service\nName: Santa Juno\nPriority: Callback\nThe full lead is in your portal: https://www.juneaudigitaldesigns.com/portal/l/rB4mT8sZ\nReply STOP to opt out, HELP for help",
    );
});

test("links on: the only URL in either text is ours, on www, never the apex or a shortener", async () => {
    process.env.OWNER_TEXT_LINKS = "on";
    await notifyOwnerOfLead(lead({ name: "Visit bit.ly/x now" }));
    await notifyOwnerOfCall(call({ callerName: "see evil.example" }));
    for (const { Body } of twilioCalls) {
        const urls = Body.match(/https?:\/\/\S+|\b[\w-]+\.(com|ly|example|io)\b\S*/g) ?? [];
        assert.equal(urls.length, 1, `exactly one URL in: ${Body}`);
        assert.match(urls[0], /^https:\/\/www\.juneaudigitaldesigns\.com\/portal\/l\/[A-Za-z0-9]{8}$/);
    }
    assert.equal(links.OWNER_TEXT_ORIGIN, "https://www.juneaudigitaldesigns.com");
    assert.throws(() => links.ownerLinkUrl("../evil"));
});

test("links on, but nothing to link to: today's brief, and no link minted", async () => {
    process.env.OWNER_TEXT_LINKS = "on";
    await notifyOwnerOfCall(call({ recordId: null }));
    await notifyOwnerOfCall(call({ callId: "call_aaaaaaaaaaaaaaaaaaaaaaaaaaa", recordId: "not-a-record" }));
    for (const { Body } of twilioCalls) assert.equal(Body, TODAY_BRIEF);
    assert.deepEqual(linkKeys(), []);
});

test("links on, KV refuses the link: the owner still gets today's text", async () => {
    process.env.OWNER_TEXT_LINKS = "on";
    kvSetFails = true;
    await notifyOwnerOfLead(lead());
    assert.equal(twilioCalls[0].Body, "New lead from Maria Lopez — open your portal.");
});

/* ── /portal/l/<id>: only the account it was made for ─────────────────────── */

async function mint(itemId) {
    process.env.OWNER_TEXT_LINKS = "on";
    const url = await links.ownerItemLink({ acctScope: ACCT, slug: SLUG, itemId });
    return url.match(LINK)[1];
}
const owner = { email: OWNER_EMAIL, sites: [{ slug: SLUG }] };

test("the owner's link opens the Inbox on that lead, or on that call", async () => {
    assert.equal(
        await links.resolveOwnerLink({ id: await mint("lead:abc-123"), viewer: owner }),
        "/portal/calls?site=arthurs-plumbing&open=lead%3Aabc-123",
    );
    assert.equal(await links.resolveOwnerLink({ id: await mint(REC), viewer: owner }), `/portal/calls?site=arthurs-plumbing&open=${REC}`);
});

test("another account's id gets exactly the not-found answer, revealing nothing", async () => {
    const id = await mint(REC);
    const stranger = { email: OTHER_EMAIL, sites: [{ slug: SLUG }] }; // even one claiming the same slug
    const foreign = await links.resolveOwnerLink({ id, viewer: stranger });
    const missing = await links.resolveOwnerLink({ id: "ZZZZZZZZ", viewer: stranger });
    const malformed = await links.resolveOwnerLink({ id: "../../x", viewer: stranger });
    assert.equal(foreign, links.OWNER_LINK_FALLBACK_PATH);
    assert.equal(foreign, missing);
    assert.equal(foreign, malformed);
    assert.doesNotMatch(foreign, /open=|site=/);
});

test("the owner's own link stops opening once the account no longer has that site", async () => {
    const id = await mint(REC);
    assert.equal(
        await links.resolveOwnerLink({ id, viewer: { email: OWNER_EMAIL, sites: [{ slug: "other-site" }] } }),
        links.OWNER_LINK_FALLBACK_PATH,
    );
    assert.equal(await links.resolveOwnerLink({ id, viewer: null }), links.OWNER_LINK_FALLBACK_PATH);
});

test("the route answers every case through resolveOwnerLink, with one 303 and nothing else", () => {
    const src = readFileSync(new URL("../app/portal/l/[id]/route.ts", import.meta.url), "utf8");
    assert.match(src, /resolveDashboard\(\)/);
    assert.match(src, /resolveOwnerLink\(\{ id, viewer: ctx\?\.account \?\? null \}\)/);
    assert.equal((src.match(/NextResponse\./g) ?? []).length, 1, "a second response path could tell cases apart");
    assert.match(src, /NextResponse\.redirect\(new URL\(path, request\.url\), 303\)/);
});
