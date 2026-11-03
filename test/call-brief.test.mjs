/**
 * The owner's end-of-call brief, sent from the agency instead of a Make Twilio module.
 *
 * **The bug this encodes.** Each client's Make clone decided at onboarding whether to text the
 * owner and to which number, and never re-read it. Owner opt-in moved to the portal, so on
 * 2026-11-03 a Growth owner who had opted in got nothing at the end of a completed callback: the
 * fixture's clone had no Twilio module at all. Consent must be read at SEND time, by the one
 * implementation every owner text uses.
 *
 * Everything here is the real implementation. The network is the only double, exactly as in
 * owner-lead-alert.test.mjs: one stub on `globalThis.fetch` serves an in-memory Upstash and a
 * recording Twilio.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./server-only-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
const MASTER_SERVICE = `MG${"m".repeat(32)}`;
const NOTIFICATION_NUMBER = "+16893292464";
const OWNER_EMAIL = "arthur@arthursplumbing.com";
const OWNER_PHONE = "+14075550123";
const CALL = "call_b3de924319b77a74deb3456cd1d";

Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "test-auth",
    TWILIO_MESSAGING_SERVICE_SID: MASTER_SERVICE,
});

const { notifyOwnerOfCall, callBriefBody, callBriefName } = await import("../app/lib/call-brief.ts");
const { notifyOwnerOfLead } = await import("../app/lib/lead-alert.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");

const ACCT = accountScope(OWNER_EMAIL);

/* ── network doubles ──────────────────────────────────────────────────────── */

const kv = new Map();
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
        case "set": {
            // SET key value [NX] [EX n] — NX is what makes the brief once-per-call.
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
    twilioFails = false;
    process.env.TWILIO_NOTIFICATION_NUMBER = NOTIFICATION_NUMBER;
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.startsWith(KV_URL)) {
            const body = JSON.parse(init.body);
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

const call = (over = {}) => ({
    acctScope: ACCT,
    slug: "arthurs-plumbing",
    callId: CALL,
    callerName: "Santa Juno",
    priority: "callback",
    callerNumber: "+12073181838",
    ...over,
});

/* ── consent is read at send time ─────────────────────────────────────────── */

test("an owner who opted in through the portal gets the brief, on the account lane, from the notification number", async () => {
    seedAccount();
    seedConsent("granted");

    const result = await notifyOwnerOfCall(call());

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
            Body: "JDD Notification Service\nName: Santa Juno\nPriority: Callback\nThe full lead is in your portal.",
        },
    );
});

for (const status of ["revoked", "pending"]) {
    test(`an owner whose consent is ${status} gets nothing`, async () => {
        seedAccount();
        seedConsent(status);
        const result = await notifyOwnerOfCall(call());
        assert.deepEqual(result, { sent: false, reason: "no-consent" });
        assert.equal(twilioCalls.length, 0);
    });
}

test("an owner with no consent record at all gets nothing", async () => {
    seedAccount();
    const result = await notifyOwnerOfCall(call());
    assert.deepEqual(result, { sent: false, reason: "no-consent" });
    assert.equal(twilioCalls.length, 0);
});

/* ── once per call ────────────────────────────────────────────────────────── */

test("Make redelivering the same call texts the owner once", async () => {
    seedAccount();
    seedConsent("granted");

    const first = await notifyOwnerOfCall(call());
    const second = await notifyOwnerOfCall(call());

    assert.equal(first.sent, true);
    assert.deepEqual(second, { sent: false, reason: "duplicate" });
    assert.equal(twilioCalls.length, 1);
});

test("a different call for the same owner is its own brief", async () => {
    seedAccount();
    seedConsent("granted");
    await notifyOwnerOfCall(call());
    await notifyOwnerOfCall(call({ callId: "call_6444328c8c82adc4e719df1b2e2" }));
    assert.equal(twilioCalls.length, 2);
});

test("a Twilio failure never throws, and releases the claim so a redelivery can still send", async () => {
    seedAccount();
    seedConsent("granted");
    twilioFails = true;

    const failed = await notifyOwnerOfCall(call());
    assert.deepEqual(failed, { sent: false, reason: "failed" });

    twilioFails = false;
    const retried = await notifyOwnerOfCall(call());
    assert.equal(retried.sent, true);
    assert.equal(twilioCalls.length, 2);
});

/* ── nothing a stranger controls goes out under JDD's name ────────────────── */

test("a caller's name cannot carry a link or a number into the owner's text", () => {
    const body = callBriefBody({
        callerName: "Visit evil.example/x or call 407-555-0199",
        priority: "callback",
    });
    const nameLine = body.split("\n")[1];
    assert.doesNotMatch(nameLine, /evil\.example|\/|\d/);
    assert.match(nameLine, /^Name: Visit evil example x or call\b/);
});

test("no summary line — the analysed summary is a stranger's words, so it stays in the portal", () => {
    const body = callBriefBody({ callerName: "Dana", priority: "callback" });
    assert.doesNotMatch(body, /About:/);
    assert.match(body, /The full lead is in your portal\.$/);
});

test("blank or unexpected analysis values degrade to safe text, never to a stranger's string", () => {
    const body = callBriefBody({ callerName: "", priority: "" });
    assert.equal(body, "JDD Notification Service\nName: not given\nPriority: Callback\nThe full lead is in your portal.");
    assert.equal(callBriefName("4075550199"), "not given");
    assert.match(callBriefBody({ callerName: "Dana", priority: "emergency" }), /Priority: Emergency/);
    assert.match(callBriefBody({ callerName: "Dana", priority: "URGENT click here" }), /Priority: Callback/);
});

/* Xander's wording, 2026-11-03: header, name, priority, where the full lead is. No phone number. */
test("the brief opens with JDD Notification Service and carries no phone number", () => {
    const body = callBriefBody({ callerName: "Santa Juno", priority: "emergency" });
    assert.equal(body, "JDD Notification Service\nName: Santa Juno\nPriority: Emergency\nThe full lead is in your portal.");
    assert.doesNotMatch(body, /Phone|\(\d{3}\)/);
});

test("the brief is plain GSM-7, so a normal one is a single segment", () => {
    const body = callBriefBody({ callerName: "Santa Juno", priority: "emergency" });
    assert.match(body, /^[\x20-\x7E\n]+$/);
    assert.ok(body.length <= 160, `${body.length} chars`);
});

/* ── one consent implementation, two alerts ───────────────────────────────── */

test("the lead alert still sends through the shared path, unchanged", async () => {
    seedAccount();
    seedConsent("granted");
    const result = await notifyOwnerOfLead({ acctScope: ACCT, slug: "arthurs-plumbing", name: "Maria Lopez" });
    assert.equal(result.sent, true);
    assert.equal(twilioCalls[0].Body, "New lead from Maria Lopez — open your portal.");
});

test("call-brief.ts sends only through textAccountOwner — no second consent check", () => {
    const src = readFileSync(new URL("../app/lib/call-brief.ts", import.meta.url), "utf8");
    assert.match(src, /textAccountOwner\(/);
    assert.doesNotMatch(src, /sendSms|getConsentStateForAccount|isDeliverable/);
});

/* ── the route ────────────────────────────────────────────────────────────── */

test("the route sends after the response, and has no 5xx except the KV outage", () => {
    const src = readFileSync(new URL("../app/api/ingest/call/route.ts", import.meta.url), "utf8");
    assert.match(src, /after\(\(\) => notifyOwnerOfCall\(/, "the text must not be on the response path");
    const fives = [...src.matchAll(/status:\s*(5\d\d)/g)].map((m) => m[1]);
    assert.deepEqual(fives, ["503"], "a Twilio problem must never become a 5xx Make retries");
    assert.match(src, /resolveIngestToken\(token\)/);
});
