/**
 * /sms-terms shows the texts the code sends, per owner-text campaign (Xander, 2026-11-18).
 *
 * The page follows `OWNER_TEXT_CAMPAIGN` as Terms v6.0/v6.1 do: v1 (live today) or v2 after the
 * cutover. Every sample a builder exists for is held to that builder, line for line, and the page
 * is rendered under both campaigns to check each shows its own words and none of the other's.
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

const { callBriefBody, callBriefBodyV2 } = await import("../app/lib/call-brief.ts");
const { leadAlertBodyV2, replyAlertBodyV2, OWNER_TEXT_STOP_LINE } = await import("../app/lib/lead-alert.ts");
const { CALL_SUMMARY_SAMPLE, SERVICE_ALERT_SAMPLE_V1, V2_SAMPLES, PROGRAM_ONE_COPY } = await import("../app/sms-terms/samples.ts");
const { renderToStaticMarkup } = await import("react-dom/server");
const React = await import("react");
const { default: SmsTermsPage } = await import("../app/sms-terms/page.tsx");

/** The submitted samples show a placeholder in brackets; the builders sanitise names to letters. */
const unbracket = (s) => s.replace(/\[([^\]]+)\]/g, "$1");
const linkOf = (s) => s.match(/View it: (\S+)/)[1];

test("v1: the call summary is exactly what callBriefBody sends today", () => {
    assert.equal(
        CALL_SUMMARY_SAMPLE,
        callBriefBody({ callerName: "Maria Alvarez", priority: "callback", callerNumber: "+19305550117", summary: "Water heater leaking in the garage" }),
    );
});

test("v1: the service alert ends on v1's STOP and HELP line", () => {
    assert.ok(SERVICE_ALERT_SAMPLE_V1.endsWith(`${OWNER_TEXT_STOP_LINE}.`));
});

test("v2: the new-lead, call and customer-reply samples are exactly what the v2 builders send", () => {
    assert.equal(unbracket(V2_SAMPLES.newLead), leadAlertBodyV2("Customer Name", linkOf(V2_SAMPLES.newLead)));
    assert.equal(unbracket(V2_SAMPLES.callCallback), callBriefBodyV2({ callerName: "Caller Name", priority: "callback" }, linkOf(V2_SAMPLES.callCallback)));
    assert.equal(unbracket(V2_SAMPLES.callEmergency), callBriefBodyV2({ callerName: "Caller Name", priority: "emergency" }, linkOf(V2_SAMPLES.callEmergency)));
    assert.equal(unbracket(V2_SAMPLES.customerReplied), replyAlertBodyV2("Customer Name", true));
    assert.ok(V2_SAMPLES.serviceAlert.endsWith("Juneau Digital Designs: Reply STOP to opt out, HELP for help"));
});

function render(campaign) {
    if (campaign) process.env.OWNER_TEXT_CAMPAIGN = campaign;
    else delete process.env.OWNER_TEXT_CAMPAIGN;
    return renderToStaticMarkup(React.createElement(SmsTermsPage));
}
/** The page's text, entity-decoded and with whitespace collapsed, for word matching. */
const text = (html) =>
    html
        .replace(/<[^>]+>/g, " ")
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ");
const flat = (s) => s.replace(/\s+/g, " ");

test("unset (v1, live today): two kinds, v1's samples and frequency, nothing from v2", () => {
    const page = text(render(undefined));
    const v1 = PROGRAM_ONE_COPY.v1;
    assert.ok(page.includes("It sends two kinds of message:"));
    assert.ok(page.includes(flat(CALL_SUMMARY_SAMPLE)));
    assert.ok(page.includes(SERVICE_ALERT_SAMPLE_V1));
    assert.ok(page.includes(v1.frequency));
    for (const absent of ["New-lead alerts.", "Customer replies.", "New lead in your portal", "one per new lead", "four kinds"]) {
        assert.ok(!page.includes(absent), absent);
    }
});

test("v2: four kinds with Customer replies, all five v2 samples, v2's frequency, nothing from v1", () => {
    const page = text(render("v2"));
    const v2 = PROGRAM_ONE_COPY.v2;
    assert.ok(page.includes("It sends four kinds of message:"));
    for (const k of v2.kinds) assert.ok(page.includes(`${k.term} ${k.text}`), k.term);
    for (const s of Object.values(V2_SAMPLES)) assert.ok(page.includes(flat(s)), s.split("\n")[0]);
    assert.ok(page.includes(v2.frequency));
    for (const absent of ["two kinds", "Juneau Digital Designs call alert", "Juneau Digital Designs service alert:"]) {
        assert.ok(!page.includes(absent), absent);
    }
    delete process.env.OWNER_TEXT_CAMPAIGN;
});
