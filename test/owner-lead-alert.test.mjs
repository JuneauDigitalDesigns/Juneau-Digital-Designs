/**
 * Owner new-lead alert, and the account-lane sender pin it depends on.
 *
 * **The bug this encodes.** The account lane sent `From = TWILIO_NOTIFICATION_NUMBER || undefined`.
 * With the variable unset — as it is in the agency's `.env.local` today — no `From` went to
 * Twilio, and the master Messaging Service picked a sender from its pool, which holds client
 * numbers. An owner alert could go out from a client's own line, on JDD's campaign, with
 * nothing logged. jdd-ops `30acaf3` fixed the same thing on the Make side.
 *
 * Everything here is the real implementation: `sendSms`, the consent read, the owner lookup.
 * The network is the only double. The Upstash client calls the global `fetch` at request time
 * and its modules hold their own client, so there is no parameter to inject through — one
 * stub on `globalThis.fetch` serves both an in-memory Upstash and a recording Twilio.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
const MASTER_SERVICE = `MG${"m".repeat(32)}`;
const NOTIFICATION_NUMBER = "+16893292464";
const OWNER_EMAIL = "arthur@arthursplumbing.com";
const OWNER_PHONE = "+14075550123";
/** A client's own number. In production this sits in the same master pool. */
const CLIENT_NUMBER = "+14075559876";

Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "test-auth",
    TWILIO_MESSAGING_SERVICE_SID: MASTER_SERVICE,
});

// Dynamic, so the hook above is in place before `server-only` is resolved.
const { sendSms } = await import("../app/lib/twilio.ts");
const { notifyOwnerOfLead, leadAlertBody, leadAlertName } = await import("../app/lib/lead-alert.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");

const ACCT = accountScope(OWNER_EMAIL);

/* ── network doubles ──────────────────────────────────────────────────────── */

/** Upstash's REST protocol, as much of it as these paths use. Values are stored as sent. */
const kv = new Map();
/** Every request that reached Twilio, parsed. */
let twilioCalls = [];
let twilioFails = false;

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

function upstash(command) {
    const [op, ...args] = command;
    switch (op.toLowerCase()) {
        case "get": {
            const v = kv.get(args[0]);
            return v === undefined ? null : b64(v);
        }
        case "set":
            kv.set(args[0], args[1]);
            return "OK";
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
    twilioFails = false;
    process.env.TWILIO_NOTIFICATION_NUMBER = NOTIFICATION_NUMBER;

    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.startsWith(KV_URL)) {
            const body = JSON.parse(init.body);
            // `Redis.fromEnv()` auto-pipelines: a batch of commands, one result object each.
            return url.endsWith("/pipeline")
                ? Response.json(body.map((cmd) => ({ result: upstash(cmd) })))
                : Response.json({ result: upstash(body) });
        }
        if (url.startsWith("https://api.twilio.com/")) {
            twilioCalls.push(Object.fromEntries(new URLSearchParams(String(init.body))));
            return twilioFails
                ? new Response('{"code":30003}', { status: 500 })
                : Response.json({ sid: `SM${"s".repeat(32)}` });
        }
        throw new Error(`unexpected fetch: ${url}`);
    };
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

/** An account record, keyed the way both repos write it. Only the key name is read. */
function seedAccount(email = OWNER_EMAIL) {
    kv.set(`jdd:account:${email}`, JSON.stringify({ email }));
}

function seedConsent(status, email = OWNER_EMAIL, phone = OWNER_PHONE) {
    kv.set(`sms:consent:account:${email}`, phone);
    kv.set(
        `sms:consent:state:${phone}`,
        JSON.stringify({ phone, status, updatedAt: "2026-11-01T12:00:00.000Z", accountEmail: email }),
    );
}

const lead = (name = "Maria Lopez") => ({ acctScope: ACCT, slug: "arthurs-plumbing", name });

/* ── the account lane refuses to pool-pick ────────────────────────────────── */

test("account lane with TWILIO_NOTIFICATION_NUMBER unset sends nothing, rather than letting the pool pick a client's number", async () => {
    delete process.env.TWILIO_NOTIFICATION_NUMBER;

    await assert.rejects(
        sendSms({ lane: "account", to: OWNER_PHONE, body: "hi" }),
        /TWILIO_NOTIFICATION_NUMBER/,
    );
    assert.equal(twilioCalls.length, 0, "a request with no From lets the master pool choose the sender");
});

test("a blank TWILIO_NOTIFICATION_NUMBER counts as unset", async () => {
    // vercel-sync skips empty values, but a hand-entered "   " in the dashboard would not be.
    process.env.TWILIO_NOTIFICATION_NUMBER = "   ";

    await assert.rejects(sendSms({ lane: "account", to: OWNER_PHONE, body: "hi" }));
    assert.equal(twilioCalls.length, 0);
});

test("account lane pins From to the notification number inside the master service", async () => {
    await sendSms({ lane: "account", to: OWNER_PHONE, body: "hi" });

    assert.equal(twilioCalls.length, 1);
    assert.equal(twilioCalls[0].From, NOTIFICATION_NUMBER);
    assert.equal(twilioCalls[0].MessagingServiceSid, MASTER_SERVICE);
    assert.equal(twilioCalls[0].To, OWNER_PHONE);
});

test("customer lane is unaffected: its own service and number, no notification number needed", async () => {
    delete process.env.TWILIO_NOTIFICATION_NUMBER;
    const clientService = `MG${"c".repeat(32)}`;

    await sendSms({
        lane: "customer",
        messagingServiceSid: clientService,
        from: CLIENT_NUMBER,
        to: "+14075550001",
        body: "hi",
    });

    assert.equal(twilioCalls.length, 1);
    assert.equal(twilioCalls[0].From, CLIENT_NUMBER);
    assert.equal(twilioCalls[0].MessagingServiceSid, clientService);
});

/* ── the owner alert ──────────────────────────────────────────────────────── */

test("a lead for an owner with SMS consent produces exactly one account-lane text from the notification number", async () => {
    seedAccount();
    seedConsent("granted");

    const result = await notifyOwnerOfLead(lead());

    assert.equal(result.sent, true);
    assert.equal(twilioCalls.length, 1);
    assert.deepEqual(
        {
            To: twilioCalls[0].To,
            From: twilioCalls[0].From,
            MessagingServiceSid: twilioCalls[0].MessagingServiceSid,
            Body: twilioCalls[0].Body,
        },
        {
            To: OWNER_PHONE,
            From: NOTIFICATION_NUMBER,
            MessagingServiceSid: MASTER_SERVICE,
            Body: "New lead from Maria Lopez — open your portal.",
        },
    );
});

test("with the notification number unset, a consented owner gets no text at all — never one from a client's line", async () => {
    // The real failure, end to end: consent is fine, the lead is fine, the env is missing.
    delete process.env.TWILIO_NOTIFICATION_NUMBER;
    seedAccount();
    seedConsent("granted");

    const result = await notifyOwnerOfLead(lead());

    assert.deepEqual(result, { sent: false, reason: "failed" });
    assert.equal(twilioCalls.length, 0);
});

test("the owner is found from the account records when the owner-email index was never written, and cached", async () => {
    // The index is only written when an owner sends a portal message — customer-lane traffic
    // that is not live — so for nearly every account it is absent. Reading it alone would make
    // this alert a silent no-op.
    seedAccount("someone-else@example.com");
    seedAccount();
    seedConsent("granted");
    assert.equal(kv.has(`portal:crm:v2:owner-email:${ACCT}`), false);

    await notifyOwnerOfLead(lead());

    assert.equal(twilioCalls.length, 1);
    assert.equal(twilioCalls[0].To, OWNER_PHONE);
    assert.equal(kv.get(`portal:crm:v2:owner-email:${ACCT}`), OWNER_EMAIL);
});

test("never texts another account's owner", async () => {
    seedAccount("someone-else@example.com");
    seedConsent("granted", "someone-else@example.com", "+14075550999");

    const result = await notifyOwnerOfLead(lead());

    assert.deepEqual(result, { sent: false, reason: "no-owner-email" });
    assert.equal(twilioCalls.length, 0);
});

for (const [label, seed] of [
    ["no consent on record", () => {}],
    ["revoked consent", () => seedConsent("revoked")],
    ["consent awaiting the double-opt-in YES", () => seedConsent("pending-confirmation")],
]) {
    test(`${label}: nothing is sent`, async () => {
        seedAccount();
        seed();

        const result = await notifyOwnerOfLead(lead());

        assert.deepEqual(result, { sent: false, reason: "no-consent" });
        assert.equal(twilioCalls.length, 0);
    });
}

test("a Twilio failure resolves as not-sent instead of throwing into the ingest route", async () => {
    seedAccount();
    seedConsent("granted");
    twilioFails = true;

    const result = await notifyOwnerOfLead(lead());

    assert.deepEqual(result, { sent: false, reason: "failed" });
    assert.equal(twilioCalls.length, 1, "the failure must be Twilio's, not an earlier step's");
});

/* ── what a stranger's name can put in a text from JDD's number ───────────── */

test("the visitor's name cannot carry a link or a number into the alert", () => {
    assert.equal(leadAlertName("José O'Brien-Smith"), "José O'Brien-Smith");
    assert.equal(leadAlertName("Visit http://evil.example/win"), "Visit http evil example win");
    assert.equal(leadAlertName("407-555-0123"), "a website visitor");
    assert.equal(leadAlertName(null), "a website visitor");
    assert.equal(leadAlertName("   "), "a website visitor");
    assert.doesNotMatch(leadAlertBody("Click www.evil.com now"), /\.\w/);
});

test("the alert stays one UCS-2 segment however long the name", () => {
    // The em dash forces UCS-2, where one segment is 70 characters.
    const body = leadAlertBody("Bartholomew Maximilian Featherstonehaugh-Worthington III");
    assert.ok(body.length <= 70, `${body.length} chars: ${body}`);
});
