import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The text box on a customer's timeline is a bar pinned to the bottom of the timeline while it
 * scrolls (Xander, 2026-11-12). It used to sit after the last event, so on a long history you
 * scrolled to the bottom to reply.
 *
 * `position: sticky` fails silently: an ancestor between the bar and the scroller that clips
 * (`overflow` anything but visible) becomes the bar's scroll container, and the bar then sticks
 * to a box that never scrolls. So the test holds both halves: the bar is sticky, and nothing on
 * its chain inside the record clips.
 */

function code(path) {
    return readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

const record = code("app/components/portal/crm/CustomerRecord.tsx");

/** The opening tag of the element carrying `marker`. */
function tagOf(src, marker) {
    const at = src.indexOf(marker);
    assert.ok(at > 0, `${marker} is gone`);
    const open = src.lastIndexOf("<", at);
    return src.slice(open, src.indexOf(">", at) + 1);
}

test("the text bar is pinned to the bottom of the timeline", () => {
    const bar = tagOf(record, 'id="crm-composer"');
    assert.match(bar, /\bsticky\b/);
    assert.match(bar, /\bbottom-0\b/);
    // Sits at the end of its column even when the column is taller than the history.
    assert.match(bar, /\bmt-auto\b/);
    // Opaque, or the timeline shows through it as it scrolls underneath.
    assert.match(bar, /background:\s*"var\(--elev-1\)"/);
});

test("nothing between the bar and the record's scroller clips it", () => {
    // The column that holds the timeline and the bar.
    const column = tagOf(record, 'data-record-activity=""');
    assert.doesNotMatch(column, /overflow-/);
    // The record body grid around it.
    const body = tagOf(record, 'data-record-body=""');
    assert.doesNotMatch(body, /overflow-/);
});
