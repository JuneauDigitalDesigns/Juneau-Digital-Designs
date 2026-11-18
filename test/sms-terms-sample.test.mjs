/**
 * /sms-terms shows the call summary the code actually sends (Xander, 2026-11-18).
 *
 * The page used to print a one-line sample that matched no text the code sent. It now prints the
 * live v1 format, and this holds it to `callBriefBody` for the same lead, so the two cannot drift.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./server-only-hook.mjs", import.meta.url);

Object.assign(process.env, {
    KV_REST_API_URL: "https://kv.test.invalid",
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: "https://kv.test.invalid",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});

const { callBriefBody } = await import("../app/lib/call-brief.ts");
const { CALL_SUMMARY_SAMPLE } = await import("../app/sms-terms/samples.ts");

test("the page's call-summary sample is exactly what callBriefBody sends today", () => {
    assert.equal(
        CALL_SUMMARY_SAMPLE,
        callBriefBody({
            callerName: "Maria Alvarez",
            priority: "callback",
            callerNumber: "+19305550117",
            summary: "Water heater leaking in the garage",
        }),
    );
});

test("the page prints it, line breaks kept, and the old one-line sample is gone", () => {
    const page = readFileSync("app/sms-terms/page.tsx", "utf8");
    assert.match(page, /whiteSpace: "pre-line" \}\}>\{CALL_SUMMARY_SAMPLE\}<\/blockquote>/);
    assert.doesNotMatch(page, /Callback requested\. New lead Maria Alvarez/);
});
