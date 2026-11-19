/**
 * Call transcripts from Retell (2026-11-19, the mobile app rework).
 *
 * The transcript is read through the same Retell lookup the recording uses, so the end-to-end
 * route behaviour (account scoping, the shared 404) is the recording's, already pinned by
 * call-recording.test.mjs. This pins what is new: how Retell's turns are reduced, which URL the
 * page asks, and the approved wording.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./server-only-hook.mjs", import.meta.url);

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const { transcriptTurns } = await import("../app/lib/call-recording.ts");

test("Retell's turns become receptionist / caller turns, text only", () => {
    const turns = transcriptTurns({
        transcript_object: [
            { role: "agent", content: " Thanks for calling. ", words: [{ word: "Thanks", start: 0 }] },
            { role: "user", content: "Our heat is out." },
            { role: "agent", content: "   " },
            { role: "tool_call_invocation", content: "lookup" },
            { role: "user" },
        ],
    });
    assert.deepEqual(turns, [
        { speaker: "agent", text: "Thanks for calling." },
        { speaker: "caller", text: "Our heat is out." },
    ]);
    // Word timings never travel to the browser.
    assert.ok(!JSON.stringify(turns).includes("start"));
});

test("no call, or no transcript on it, is no turns", () => {
    assert.deepEqual(transcriptTurns(null), []);
    assert.deepEqual(transcriptTurns({}), []);
    assert.deepEqual(transcriptTurns({ transcript_object: "nope" }), []);
});

test("the page asks the transcript route next to the recording, keeping ?site=", () => {
    const src = read("app/components/portal/inbox/CallTranscript.tsx");
    const body = /export function transcriptUrlFor[\s\S]*?\n}/.exec(src)?.[0];
    assert.ok(body, "transcriptUrlFor is missing");
    // Evaluate the pure function from source (the component file imports React and framer-motion).
    const fn = new Function(`${body.replace("export function", "function").replace(/: string \| null/g, "")}; return transcriptUrlFor;`)();
    assert.equal(fn("/api/portal/calls/recABC123/recording?site=peak"), "/api/portal/calls/recABC123/transcript?site=peak");
    assert.equal(fn("/api/portal/calls/recABC123/recording"), "/api/portal/calls/recABC123/transcript");
    assert.equal(fn("https://cdn.example.com/x.wav"), null);
    assert.equal(fn(null), null);
});

test("approved wording: Transcript, Receptionist, and the no-transcript line", () => {
    const src = read("app/components/portal/inbox/CallTranscript.tsx");
    assert.match(src, />\s*Transcript\s*</);
    assert.match(src, /"Receptionist"/);
    assert.match(src, /There’s no transcript for this call\./);
});

test("the transcript route shares the recording's guards", () => {
    const route = read("app/api/portal/calls/[id]/transcript/route.ts");
    assert.match(route, /resolvePortalRequest\(request, getRecordingRatelimit\(\)\)/);
    assert.match(route, /AIRTABLE_RECORD_ID\.test\(id\)/);
    assert.match(route, /siteFeature\(ctx\.site, "calls"\)\.state !== "ready"/);
    assert.match(route, /scopeToSite:/);
});
