/**
 * Every text JDD sends a business owner must match the A2P campaign that is live.
 *
 * **What this encodes.** On 2026-11-10 the approved ACCOUNT_NOTIFICATION campaign (read live from
 * Twilio: VERIFIED, has_embedded_links=false) described end-of-call summaries only, with two
 * samples in a "Juneau Digital Designs call alert" format. Production was sending a different
 * brief ("JDD Notification Service" / Priority / "The full lead is in your portal."), a new-lead
 * alert the campaign never mentions, and, once wired, a customer-replied alert carrying a link.
 * All three are undeclared campaign content, which is what carriers filter.
 *
 * `OWNER_TEXT_CAMPAIGN` picks the campaign: unset = v1 (approved today), `v2` = the replacement
 * (samples approved 2026-11-08). Both modes are tested here, against the exact samples.
 *
 * Real implementations throughout. The network is the only double: an in-memory Upstash
 * (fake-upstash.mjs), a recording Twilio, and Retell's get-call.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
const MASTER_SERVICE = `MG${"m".repeat(32)}`;
const NOTIFICATION_NUMBER = "+16893292464";
const OWNER_EMAIL = "arthur@arthursplumbing.com";
const OWNER_PHONE = "+14075550123";
const SLUG = "arthurs-plumbing";
const AGENT = "agent_4b6a1f0c2d8e9a7b3c5d1e2f";
const CALL = "call_b3de924319b77a74deb3456cd1d";
const TOKEN = "t".repeat(64);
const RETELL_KEY = "key_test_retell";

Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "test-auth",
    TWILIO_MESSAGING_SERVICE_SID: MASTER_SERVICE,
});

const { accountScope } = await import("../app/lib/portal-kv.ts");
const ACCT = accountScope(OWNER_EMAIL);

const redis = fakeUpstash({
    url: KV_URL,
    resolve: (key) => (key === `portal:lead:token:v1:${TOKEN}` ? { acctScope: ACCT, slug: SLUG } : undefined),
});

const callBrief = await import("../app/lib/call-brief.ts");
const leadAlert = await import("../app/lib/lead-alert.ts");
const { sendSms } = await import("../app/lib/twilio.ts");
const { POST: leadPOST } = await import("../app/api/ingest/lead/route.ts");
const { listLeads } = await import("../app/lib/portal-leads.ts");

/* ── the samples, exactly as registered / approved ────────────────────────── */

// Read live from Twilio 2026-11-10. Twilio stores them with CRLF (they were typed into a form);
// texts go out with LF, so the comparison is on the lines.
const V1_SAMPLE_1 =
    "Juneau Digital Designs call alert\r\nName: Jane Smith\r\nStatus: Urgent\r\nPhone: (555) 123-4567\r\nAbout: AC has been out for hours, kids at home\r\nReply STOP to opt out, HELP for help";
const V1_SAMPLE_2 =
    "Juneau Digital Designs call alert\r\nName: John Wagner\r\nStatus: Callback\r\nPhone: (555) 765-4321\r\nAbout: Quote for water heater replacement\r\nReply STOP to opt out, HELP for help";
const lf = (s) => s.replace(/\r\n/g, "\n");

const V2_STOP = "Juneau Digital Designs: Reply STOP to opt out, HELP for help";
const LINK = /https:\/\/www\.juneaudigitaldesigns\.com\/portal\/l\/([A-Za-z0-9]{8})/;
const asSampleLink = (body) => body.replace(LINK, "https://www.juneaudigitaldesigns.com/portal/l/{id}");

/* ── network doubles ──────────────────────────────────────────────────────── */

let twilioCalls = [];
let retellCalls = [];
/** What Retell's get-call answers: a function of the call id, or "500" / "throw". */
let retell = () => null;
const realFetch = globalThis.fetch;

function seed(key, value) {
    redis.kv.set(key, { value: typeof value === "string" ? value : JSON.stringify(value), exp: null });
}

function seedOwner({ agentId = AGENT, consent = "granted" } = {}) {
    seed(`jdd:account:${OWNER_EMAIL}`, {
        email: OWNER_EMAIL,
        sites: [{ slug: SLUG, plan: "starter", status: "live", addedAt: 1, retellAgentId: agentId }],
        createdAt: 1,
        updatedAt: 1,
    });
    seed(`sms:consent:account:${OWNER_EMAIL}`, OWNER_PHONE);
    seed(`sms:consent:state:${OWNER_PHONE}`, {
        phone: OWNER_PHONE,
        status: consent,
        updatedAt: "2026-11-01T12:00:00.000Z",
        accountEmail: OWNER_EMAIL,
    });
}

const retellCall = (summary, agentId = AGENT) => (id) => ({
    call_id: id,
    agent_id: agentId,
    call_analysis: { call_summary: summary },
});

beforeEach(() => {
    redis.reset();
    twilioCalls = [];
    retellCalls = [];
    retell = () => null;
    process.env.TWILIO_NOTIFICATION_NUMBER = NOTIFICATION_NUMBER;
    process.env.RETELL_API_KEY = RETELL_KEY;
    delete process.env.OWNER_TEXT_CAMPAIGN;
    delete process.env.OWNER_TEXT_LINKS;
    delete process.env.INGEST_REQUIRE_ADMISSION;
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (redis.owns(url)) return redis.handle(input, init);
        if (url.startsWith("https://api.twilio.com/")) {
            twilioCalls.push(Object.fromEntries(new URLSearchParams(String(init.body))));
            return Response.json({ sid: `SM${"s".repeat(32)}` });
        }
        if (url.startsWith("https://api.retellai.com/v2/get-call/")) {
            const id = decodeURIComponent(url.split("/").pop());
            retellCalls.push({ id, auth: new Headers(init.headers).get("authorization") });
            const answer = retell(id);
            if (answer === "throw") throw new TypeError("fetch failed");
            if (answer === "500") return new Response("upstream", { status: 500 });
            return answer ? Response.json(answer) : new Response("not found", { status: 404 });
        }
        throw new Error(`unexpected fetch: ${url}`);
    };
});

afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.OWNER_TEXT_CAMPAIGN;
    delete process.env.OWNER_TEXT_LINKS;
});

const call = (over = {}) => ({
    acctScope: ACCT,
    slug: SLUG,
    callId: CALL,
    callerName: "Jane Smith",
    priority: "emergency",
    callerNumber: "+15551234567",
    recordId: "recIrliSdvpruSVij",
    ...over,
});
const flush = () => new Promise((r) => setTimeout(r, 20));

/* ══ v1 (default): the campaign approved today ═════════════════════════════ */

test("v1: the brief is registered sample 1, word for word", () => {
    const body = callBrief.callBriefBody({
        callerName: "Jane Smith",
        priority: "emergency",
        callerNumber: "+15551234567",
        summary: "AC has been out for hours, kids at home",
    });
    assert.equal(body, lf(V1_SAMPLE_1));
});

test("v1: the brief is registered sample 2, word for word", () => {
    const body = callBrief.callBriefBody({
        callerName: "John Wagner",
        priority: "callback",
        callerNumber: "5557654321",
        summary: "Quote for water heater replacement",
    });
    assert.equal(body, lf(V1_SAMPLE_2));
});

test("v1 end to end: the summary is fetched from Retell by call_id and the owner gets the sample format", async () => {
    seedOwner();
    retell = retellCall("AC has been out for hours, kids at home");

    const result = await callBrief.notifyOwnerOfCall(call());

    assert.equal(result.sent, true);
    assert.deepEqual(retellCalls, [{ id: CALL, auth: `Bearer ${RETELL_KEY}` }]);
    assert.equal(twilioCalls.length, 1);
    assert.equal(twilioCalls[0].Body, lf(V1_SAMPLE_1));
    assert.equal(twilioCalls[0].From, NOTIFICATION_NUMBER);
    assert.equal(twilioCalls[0].MessagingServiceSid, MASTER_SERVICE);
});

for (const [label, answer] of [
    ["Retell answers 500", () => "500"],
    ["Retell is unreachable", () => "throw"],
    ["Retell does not know the call", () => null],
    ["the summary is empty", retellCall("   ")],
    ["the summary is nothing but a link", retellCall("https://evil.example/x")],
]) {
    test(`v1: ${label} — the brief still goes, without an About line`, async () => {
        seedOwner();
        retell = answer;
        const result = await callBrief.notifyOwnerOfCall(call({ priority: "callback" }));
        assert.equal(result.sent, true);
        assert.equal(
            twilioCalls[0].Body,
            "Juneau Digital Designs call alert\nName: Jane Smith\nStatus: Callback\nPhone: (555) 123-4567\nReply STOP to opt out, HELP for help",
        );
    });
}

test("v1: a call on another client's agent never lends its summary to this owner's text", async () => {
    seedOwner();
    retell = retellCall("Someone else's private call", "agent_someone_else_0000000000");
    await callBrief.notifyOwnerOfCall(call());
    assert.doesNotMatch(twilioCalls[0].Body, /About:|private/);
});

test("v1: a site with no agent on record never asks Retell, and the brief still goes", async () => {
    seedOwner({ agentId: null });
    retell = retellCall("should not be read");
    const result = await callBrief.notifyOwnerOfCall(call());
    assert.equal(result.sent, true);
    assert.equal(retellCalls.length, 0);
    assert.doesNotMatch(twilioCalls[0].Body, /About:/);
});

test("v1: an owner without consent costs no Retell request and gets nothing", async () => {
    seedOwner({ consent: "revoked" });
    retell = retellCall("AC out");
    assert.deepEqual(await callBrief.notifyOwnerOfCall(call()), { sent: false, reason: "no-consent" });
    assert.equal(retellCalls.length, 0);
    assert.equal(twilioCalls.length, 0);
});

test("v1: once per call still holds", async () => {
    seedOwner();
    retell = retellCall("AC out");
    await callBrief.notifyOwnerOfCall(call());
    assert.deepEqual(await callBrief.notifyOwnerOfCall(call()), { sent: false, reason: "duplicate" });
    assert.equal(twilioCalls.length, 1);
});

/* ── the About line: model-written prose about what a stranger said ───────── */

test("the summary loses URLs, bare domains and spelled-out domains", () => {
    const s = callBrief.callBriefSummary(
        "Caller wants a quote, see https://evil.example/win and www.spam.io or bit.ly/x or visit deals dot com today",
    );
    assert.doesNotMatch(s, /http|www|evil|spam|bit\.ly|\bdot com\b|\.io|\.ly/i);
    assert.match(s, /^Caller wants a quote/);
});

test("the summary loses email addresses", () => {
    const s = callBrief.callBriefSummary("Send the estimate to jane.smith@example.com before Friday");
    assert.doesNotMatch(s, /@|example|jane\.smith/);
    assert.match(s, /Send the estimate to\b.*before Friday/);
});

test("the summary loses anything resembling a phone number", () => {
    for (const n of ["(407) 555-0199", "407-555-0199", "407.555.0199", "+1 407 555 0199", "4075550199", "555-0199"]) {
        const s = callBrief.callBriefSummary(`Call me back on ${n} after five`);
        assert.doesNotMatch(s, /\d{3}/, `${n} survived: ${s}`);
        assert.match(s, /^Call me back on\b.*after five$/);
    }
    // Ordinary small numbers are not phone numbers.
    assert.equal(callBrief.callBriefSummary("Leak under 2 sinks, 3rd floor"), "Leak under 2 sinks, 3rd floor");
});

test("the summary is GSM-7, whitespace-collapsed, and capped near 100 characters at a word boundary", () => {
    const s = callBrief.callBriefSummary(
        "The caller’s “AC” has been out—for   hours…\n\nKids are at home 🥵 and the unit is making a loud grinding noise every few minutes, so they want someone today",
    );
    assert.match(s, /^[A-Za-z0-9 .,;:!?'"()&%/$+-]+$/, `not plain GSM-7: ${s}`);
    assert.doesNotMatch(s, /\s{2}/);
    assert.ok(s.length <= 100, `${s.length} chars`);
    assert.ok(s.endsWith("..."));
    assert.doesNotMatch(s, /\s\.\.\.$/, "cut at a word, not mid-space");
    assert.ok(s.startsWith(`The caller's "AC" has been out-for hours...`));
});

test("a summary with nothing left after cleaning is no summary", () => {
    for (const raw of [null, undefined, "", "   ", "https://x.example", "407-555-0199", "a@b.co"]) {
        assert.equal(callBrief.callBriefSummary(raw), null, JSON.stringify(raw));
    }
});

test("Phone: US numbers as (555) 123-4567; withheld or junk numbers say Not available", () => {
    assert.equal(callBrief.callBriefPhone("+12073181838"), "(207) 318-1838");
    assert.equal(callBrief.callBriefPhone("2073181838"), "(207) 318-1838");
    assert.equal(callBrief.callBriefPhone("+447911123456"), "+447911123456");
    for (const raw of [null, "", "anonymous", "Restricted", "+266696687", "+86282452253", "12345", "call 4075550123 now"]) {
        assert.equal(callBrief.callBriefPhone(raw), "Not available", JSON.stringify(raw));
    }
});

test("Name: the existing filter, with Not given when no name was spoken", () => {
    assert.equal(callBrief.callBriefName(""), "Not given");
    assert.equal(callBrief.callBriefName("4075550199"), "Not given");
    assert.equal(callBrief.callBriefName("Visit evil.example"), "Visit evil example");
    assert.equal(callBrief.callBriefName("José O'Brien"), "José O'Brien");
});

/* ── v1: no link, ever ────────────────────────────────────────────────────── */

test("v1 with OWNER_TEXT_LINKS=on: still no link, and none minted", async () => {
    process.env.OWNER_TEXT_LINKS = "on";
    seedOwner();
    retell = retellCall("AC out");
    await callBrief.notifyOwnerOfCall(call());
    assert.doesNotMatch(twilioCalls[0].Body, /http|View it/);
    assert.equal([...redis.kv.keys()].filter((k) => k.startsWith("portal:owner-link:")).length, 0);
});

test("no owner text contains http under the default campaign, whatever goes in", async () => {
    process.env.OWNER_TEXT_LINKS = "on";
    seedOwner();
    retell = retellCall("Wants a quote, details at http://evil.example/q and www.evil.example");
    await callBrief.notifyOwnerOfCall(call({ callerName: "see http://evil.example" }));
    await leadAlert.notifyOwnerOfLead({ acctScope: ACCT, slug: SLUG, name: "Maria", leadId: "4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c" });
    await leadAlert.notifyOwnerOfCustomerReply({ acctScope: ACCT, slug: SLUG, customerName: "Dana" });
    assert.ok(twilioCalls.length >= 1, "the brief must still go out");
    for (const { Body } of twilioCalls) assert.doesNotMatch(Body, /http/i, Body);
});

test("v1: the account lane itself refuses a body with a link", async () => {
    await assert.rejects(sendSms({ lane: "account", to: OWNER_PHONE, body: "see https://x.example" }), /link/);
    await assert.rejects(sendSms({ lane: "account", to: OWNER_PHONE, body: "see www.example.com" }), /link/);
    assert.equal(twilioCalls.length, 0);
});

/* ── v1: undescribed owner texts are paused, and nothing is lost ──────────── */

test("v1: the new-lead alert is paused by default, with its own reason", async () => {
    seedOwner();
    const result = await leadAlert.notifyOwnerOfLead({ acctScope: ACCT, slug: SLUG, name: "Maria Lopez" });
    assert.deepEqual(result, { sent: false, reason: "paused" });
    assert.equal(twilioCalls.length, 0);
});

test("v1: a web-form lead is still recorded and in the portal inbox; only the owner text stops", async () => {
    seedOwner();
    const res = await leadPOST(
        new Request("https://www.juneaudigitaldesigns.com/api/ingest/lead", {
            method: "POST",
            headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
            body: JSON.stringify({ name: "Maria Lopez", phone: "+14075550188", message: "AC is out" }),
        }),
    );
    await flush();
    assert.equal(res.status, 200);
    const leads = await listLeads(ACCT, SLUG);
    assert.equal(leads.length, 1);
    assert.equal(leads[0].name, "Maria Lopez");
    assert.equal(twilioCalls.length, 0, "no owner text under v1");
});

test("v1: the customer-replied alert is paused", async () => {
    seedOwner();
    seed(`portal:crm:v2:owner-email:${ACCT}`, OWNER_EMAIL);
    const result = await leadAlert.notifyOwnerOfCustomerReply({ acctScope: ACCT, slug: SLUG, customerName: "Dana" });
    assert.deepEqual(result, { sent: false, reason: "paused" });
    assert.equal(twilioCalls.length, 0);
});

test("only the exact value v2 leaves v1", async () => {
    seedOwner();
    for (const value of ["V2", "2", "v2 ", "on", "true", ""]) {
        process.env.OWNER_TEXT_CAMPAIGN = value;
        const expectV2 = value.trim() === "v2";
        const r = await leadAlert.notifyOwnerOfLead({ acctScope: ACCT, slug: SLUG, name: "Maria" });
        assert.equal(r.sent, expectV2, JSON.stringify(value));
    }
});

/* ══ v2: the replacement campaign (samples approved 2026-11-08) ════════════ */

test("v2: call brief, Callback, no link", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    seedOwner();
    await callBrief.notifyOwnerOfCall(call({ callerName: "Santa Juno", priority: "callback" }));
    assert.equal(twilioCalls[0].Body, `New call lead in your portal\nName: Santa Juno\nPriority: Callback\n${V2_STOP}`);
    assert.equal(retellCalls.length, 0, "v2 has no About line, so Retell is not asked");
});

test("v2: call brief, Emergency, with link", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    process.env.OWNER_TEXT_LINKS = "on";
    seedOwner();
    await callBrief.notifyOwnerOfCall(call({ callerName: "Santa Juno", priority: "emergency" }));
    assert.equal(
        asSampleLink(twilioCalls[0].Body),
        `New call lead in your portal\nName: Santa Juno\nPriority: Emergency\nView it: https://www.juneaudigitaldesigns.com/portal/l/{id}\n${V2_STOP}`,
    );
});

test("v2: call brief with links on but nothing to link to omits the View it line", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    process.env.OWNER_TEXT_LINKS = "on";
    seedOwner();
    await callBrief.notifyOwnerOfCall(call({ callerName: "", priority: "callback", recordId: null }));
    assert.equal(twilioCalls[0].Body, `New call lead in your portal\nName: Not given\nPriority: Callback\n${V2_STOP}`);
});

test("v2: new lead, no link", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    seedOwner();
    const r = await leadAlert.notifyOwnerOfLead({ acctScope: ACCT, slug: SLUG, name: "Maria Lopez", leadId: "4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c" });
    assert.equal(r.sent, true);
    assert.equal(twilioCalls[0].Body, `New lead in your portal\nFrom: Maria Lopez\n${V2_STOP}`);
});

test("v2: new lead, with link", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    process.env.OWNER_TEXT_LINKS = "on";
    seedOwner();
    await leadAlert.notifyOwnerOfLead({ acctScope: ACCT, slug: SLUG, name: "Maria Lopez", leadId: "4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c" });
    assert.equal(
        asSampleLink(twilioCalls[0].Body),
        `New lead in your portal\nFrom: Maria Lopez\nView it: https://www.juneaudigitaldesigns.com/portal/l/{id}\n${V2_STOP}`,
    );
});

test("v2: customer replied, with link", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    process.env.OWNER_TEXT_LINKS = "on";
    seedOwner();
    seed(`portal:crm:v2:owner-email:${ACCT}`, OWNER_EMAIL);
    const r = await leadAlert.notifyOwnerOfCustomerReply({ acctScope: ACCT, slug: SLUG, customerName: "Dana Reyes" });
    assert.equal(r.sent, true);
    assert.equal(
        twilioCalls[0].Body,
        `New message in your portal\nFrom: Dana Reyes\nView it: https://www.juneaudigitaldesigns.com/portal/customers\n${V2_STOP}`,
    );
});

test("v2: customer replied, links off omits the View it line", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    seedOwner();
    seed(`portal:crm:v2:owner-email:${ACCT}`, OWNER_EMAIL);
    await leadAlert.notifyOwnerOfCustomerReply({ acctScope: ACCT, slug: SLUG, customerName: null });
    assert.equal(twilioCalls[0].Body, `New message in your portal\nFrom: a customer\n${V2_STOP}`);
});

test("v2: the web-form lead is recorded and the owner is texted", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    seedOwner();
    const res = await leadPOST(
        new Request("https://www.juneaudigitaldesigns.com/api/ingest/lead", {
            method: "POST",
            headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
            body: JSON.stringify({ name: "Maria Lopez", phone: "+14075550188", message: "AC is out" }),
        }),
    );
    await flush();
    assert.equal(res.status, 200);
    assert.equal((await listLeads(ACCT, SLUG)).length, 1);
    assert.equal(twilioCalls.length, 1);
    assert.match(twilioCalls[0].Body, /^New lead in your portal\nFrom: Maria Lopez\n/);
});

/* ══ the sender is env only, and every account-lane send is accounted for ═══ */

const APP = fileURLToPath(new URL("../app/", import.meta.url));
function* sources(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) yield* sources(p);
        else if (/\.(ts|tsx|mjs|js)$/.test(name)) yield p;
    }
}

test("no source names a Messaging Service SID or the notification number; both come from env", () => {
    for (const file of sources(APP)) {
        const src = readFileSync(file, "utf8");
        assert.doesNotMatch(src, /\bMG[0-9a-f]{32}\b/, `${file} hard-codes a Messaging Service`);
        assert.doesNotMatch(src, /16893292464/, `${file} hard-codes the notification number`);
    }
    const twilio = readFileSync(join(APP, "lib", "twilio.ts"), "utf8");
    assert.match(twilio, /process\.env\.TWILIO_MESSAGING_SERVICE_SID/);
    assert.match(twilio, /process\.env\.TWILIO_NOTIFICATION_NUMBER/);
});

test("every account-lane send is one of the reviewed owner texts", () => {
    // A new owner text must be checked against the live campaign before it ships. Add it here
    // only once it has a campaign mode (owner-text-campaign.ts) and a sample test above.
    const reviewed = new Set([
        join("lib", "twilio.ts"), // the lane's type definition and sendSms itself
        join("lib", "lead-alert.ts"), // textAccountOwner (brief + lead alert) and the customer-replied alert
        join("lib", "checkout-fulfillment.ts"), // double opt-in confirmation request (SMS_DOUBLE_OPTIN)
    ]);
    const found = [];
    for (const file of sources(APP)) {
        if (/lane:\s*["']account["']/.test(readFileSync(file, "utf8"))) found.push(file.slice(APP.length));
    }
    assert.deepEqual(found.sort(), [...reviewed].sort());
});
