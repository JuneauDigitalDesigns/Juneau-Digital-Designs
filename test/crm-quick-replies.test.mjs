/**
 * Quick replies on the customer card.
 *
 * The greeting rule and the response parsing are pure and tested directly. Where the chips may
 * appear is a UI rule, pinned at the source: only inside the composer's existing
 * `messagingState === "ready"` branch, which is Growth/Enterprise with A2P verified
 * (Xander, 2026-11-09: texting only from the customer card, once A2P has completed).
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { firstName, parseTemplates, prefillReply } from "../app/components/portal/crm/replyTemplates.ts";

test("a quick reply is greeted by first name and reads as one sentence", () => {
    assert.equal(
        prefillReply("Dave Kowalski", "On a job right now. I'll call you back by 5."),
        "Hi Dave, on a job right now. I'll call you back by 5.",
    );
    assert.equal(prefillReply("Dave", "I'm on my way."), "Hi Dave, I'm on my way.", "I stays I");
    assert.equal(prefillReply("Dave", "I’ll be there at 3."), "Hi Dave, I’ll be there at 3.");
    assert.equal(prefillReply(null, "Can you send a photo of it?"), "Hi, can you send a photo of it?");
    assert.equal(prefillReply("(512) 555-0147", "Thanks!"), "Hi, thanks!", "a number is not a name");
    assert.equal(prefillReply("Ana", "  Thanks!  "), "Hi Ana, thanks!");
});

test("first names", () => {
    assert.equal(firstName("  Carol  Ostrander "), "Carol");
    assert.equal(firstName("+15125550147"), null);
    assert.equal(firstName(""), null);
    assert.equal(firstName(null), null);
});

test("only the documented shape counts as quick replies being available", () => {
    assert.deepEqual(
        parseTemplates({
            templates: [
                { id: "a", body: "Can you send a photo of it?", builtIn: true },
                { id: "b", body: "Custom" },
                { id: 3, body: "bad id" },
                { id: "c", body: "   " },
            ],
        }),
        [
            { id: "a", body: "Can you send a photo of it?", builtIn: true },
            { id: "b", body: "Custom", builtIn: false },
        ],
    );
    assert.deepEqual(parseTemplates({ templates: [] }), [], "an empty list is still the feature");
    assert.equal(parseTemplates({}), null);
    assert.equal(parseTemplates({ error: "Not found" }), null);
    assert.equal(parseTemplates(null), null);
});

const read = (p) => readFileSync(new URL(`../app/components/portal/crm/${p}`, import.meta.url), "utf8");

test("quick replies render only inside the composer's messaging-ready branch", () => {
    const src = read("CustomerRecord.tsx");
    const ready = src.indexOf('data?.messagingState === "ready" ?');
    const notOnPlan = src.indexOf('data?.messagingState === "not-on-plan" ?', ready);
    const at = src.indexOf("<QuickReplies");
    assert.ok(ready > 0 && notOnPlan > ready, "the gate is where it was");
    assert.ok(at > ready && at < notOnPlan, "QuickReplies sits inside the ready branch");
    assert.equal(src.split("<QuickReplies").length - 1, 1, "and nowhere else");
});

test("quick replies never send and add no gate of their own", () => {
    for (const f of ["QuickReplies.tsx", "useReplyTemplates.ts", "replyTemplates.ts"]) {
        // Code only: the comments are free to explain the gate they sit behind.
        const src = read(f)
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, "");
        assert.doesNotMatch(src, /\/api\/portal\/messages["`]/, `${f} sends a text`);
        assert.doesNotMatch(src, /siteFeature|messagingState|a2pStatus/, `${f} invents a gate`);
    }
    // Hidden until the backend answers with templates.
    assert.match(read("QuickReplies.tsx"), /if \(templates\.state !== "ready"\) return null;/);
});
