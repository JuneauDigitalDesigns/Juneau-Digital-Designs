/**
 * The Inbox's reading of the list: status, date sections, chip counts, reminder times.
 *
 * All of it lives in `app/components/portal/inbox/model.ts` (and the status rule in
 * `app/lib/crm-contacts.ts`), pure and clock-injected, so it is tested here rather than through
 * a browser. Times are built with the local-time `Date` constructor on purpose: the sections
 * and the reminder presets are the *owner's* today, and the suite should pass in any zone.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { filterInbox, inboxStatus, isNeedsYou } from "../app/lib/crm-contacts.ts";
import {
    callbackGap,
    firstName,
    fullWhen,
    greeting,
    handledThisWeek,
    inboxCounts,
    inboxRows,
    neighbourRow,
    parsePickedTime,
    prefillReply,
    reasonFor,
    remindChip,
    remindPresets,
    remindToast,
    rowWhen,
    sectionFor,
    sectionRows,
    startOfWeek,
    stepRow,
    tomorrowMorning,
} from "../app/components/portal/inbox/model.ts";

/** Monday 9 November 2026, 10:00 local. */
const NOW = new Date(2026, 10, 9, 10, 0);
const local = (d, h = 9, m = 0) => new Date(2026, 10, d, h, m).toISOString();

let seq = 0;
/** An inbox item as `buildInbox` emits it, with only what a test cares about varied. */
function item(overrides = {}) {
    seq += 1;
    return {
        id: `rec${String(seq).padStart(14, "0")}`,
        source: "call",
        name: "Dave Kowalski",
        phone: `+1512555${String(1000 + seq).slice(-4)}`,
        phoneDisplay: "(512) 555-0129",
        callbackPhone: null,
        callbackPhoneDisplay: null,
        email: null,
        preview: "Furnace quit overnight.",
        at: local(9, 8),
        read: false,
        promoted: false,
        archived: false,
        remindAt: null,
        durationSeconds: 118,
        recordingUrl: null,
        address: null,
        outcome: null,
        callback: null,
        ...overrides,
    };
}

/* ── the status rule ──────────────────────────────────────────────────────── */

test("Needs you is: not Done, not promoted, not reminded until later", () => {
    const now = NOW.getTime();
    assert.equal(inboxStatus(item(), now), "needs");
    assert.equal(inboxStatus(item({ archived: true }), now), "done");
    assert.equal(inboxStatus(item({ promoted: true }), now), "promoted");
    assert.equal(inboxStatus(item({ remindAt: local(10, 7) }), now), "reminded");
});

test("a reminder that has come due is back in Needs you with nothing written", () => {
    const now = NOW.getTime();
    assert.equal(inboxStatus(item({ remindAt: local(9, 9, 59) }), now), "needs", "a minute ago");
    assert.equal(inboxStatus(item({ remindAt: NOW.toISOString() }), now), "needs", "exactly now");
    assert.equal(inboxStatus(item({ remindAt: "not a date" }), now), "needs", "junk is ignored");
    assert.equal(inboxStatus(item({ remindAt: undefined }), now), "needs", "no backend yet");
});

test("promoted outranks Done, and Done outranks a reminder", () => {
    const now = NOW.getTime();
    assert.equal(inboxStatus(item({ promoted: true, archived: true }), now), "promoted");
    assert.equal(inboxStatus(item({ archived: true, remindAt: local(12) }), now), "done");
});

test("each view holds what its chip says", () => {
    const now = NOW.getTime();
    const open = item();
    const form = item({ source: "web-form", id: "lead:F1" });
    const done = item({ archived: true });
    const later = item({ remindAt: local(10, 7) });
    const customer = item({ promoted: true });
    const items = [open, form, done, later, customer];
    const view = (f) => filterInbox(items, f, "", now).map((i) => i.id);

    assert.deepEqual(view("needs"), [open.id, form.id]);
    assert.deepEqual(view("all"), [open.id, form.id, done.id, later.id], "everything but customers");
    assert.deepEqual(view("calls"), [open.id, done.id, later.id]);
    assert.deepEqual(view("forms"), [form.id]);
    assert.deepEqual(view("reminders"), [later.id]);
    assert.deepEqual(view("done"), [done.id]);
    assert.deepEqual(view("promoted"), [customer.id]);
});

/* ── rows ─────────────────────────────────────────────────────────────────── */

test("a person who rang on two days is one row, placed by the latest call", () => {
    const now = NOW.getTime();
    const phone = "+15125550147";
    const today = item({ phone, at: local(9, 8) });
    const friday = item({ phone, at: local(6, 15) });
    const rows = inboxRows([today, friday], "needs", "", now);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].count, 2);
    assert.equal(rows[0].lead.id, today.id);
    assert.equal(sectionRows(rows, NOW)[0].key, "today", "under Today, not under Friday");
});

test("in All, one person's waiting calls and their Done call are separate rows", () => {
    const now = NOW.getTime();
    const phone = "+15125550188";
    const waiting = item({ phone, at: local(9, 8) });
    const finished = item({ phone, at: local(8, 8), archived: true });
    const rows = inboxRows([waiting, finished], "all", "", now);

    assert.deepEqual(
        rows.map((r) => [r.status, r.count]),
        [
            ["needs", 1],
            ["done", 1],
        ],
    );
    assert.notEqual(rows[0].id, rows[1].id, "row ids are unique even for one contact");
});

test("rows are newest first across statuses", () => {
    const now = NOW.getTime();
    const older = item({ at: local(9, 7) });
    const newer = item({ at: local(9, 9), archived: true });
    assert.deepEqual(
        inboxRows([older, newer], "all", "", now).map((r) => r.lead.id),
        [newer.id, older.id],
    );
});

test("chip counts are rows, not calls", () => {
    const now = NOW.getTime();
    const phone = "+15125550101";
    const counts = inboxCounts(
        [
            item({ phone, at: local(9, 9) }),
            item({ phone, at: local(9, 8) }),
            item({ phone, at: local(9, 7) }),
            item({ source: "web-form", id: "lead:F2" }),
            item({ remindAt: local(10, 7) }),
            item({ archived: true }),
            item({ archived: true }),
            item({ promoted: true }),
        ],
        now,
    );
    assert.deepEqual(counts, { needs: 2, reminders: 1, promoted: 1, done: 2 });
});

test("handled this week counts this week's leads that are Done or promoted, nothing else", () => {
    const now = NOW.getTime();
    const items = [
        item({ archived: true, at: local(9, 8) }),
        item({ promoted: true, at: local(9, 7) }),
        item({ archived: true, at: local(8, 8) }), // Sunday: last week
        item({ at: local(9, 6) }), // still waiting
        item({ remindAt: local(10, 7), at: local(9, 5) }), // set aside, not handled
    ];
    assert.equal(handledThisWeek(items, now), 2);
});

test("after Done, the pane moves to the next row, else the one before", () => {
    const rows = ["a", "b", "c"].map((id) => ({ id }));
    assert.equal(neighbourRow(rows, ["b"]).id, "c");
    assert.equal(neighbourRow(rows, ["c"]).id, "b");
    assert.equal(neighbourRow(rows, ["a", "b"]).id, "c");
    assert.equal(neighbourRow(rows, ["a", "b", "c"]), null);
    assert.equal(neighbourRow(rows, ["zzz"]), null);
});

test("j and k stop at the ends and start from the top", () => {
    const rows = ["a", "b", "c"].map((id) => ({ id }));
    assert.equal(stepRow(rows, "a", 1).id, "b");
    assert.equal(stepRow(rows, "c", 1).id, "c");
    assert.equal(stepRow(rows, "a", -1).id, "a");
    assert.equal(stepRow(rows, null, 1).id, "a");
    assert.equal(stepRow([], "a", 1), null);
});

/* ── date sections ────────────────────────────────────────────────────────── */

test("sections follow the owner's clock: Today, Yesterday, Earlier this week, Earlier", () => {
    const wed = new Date(2026, 10, 11, 10, 0);
    assert.equal(sectionFor(local(11, 0, 1), wed), "today");
    assert.equal(sectionFor(local(10, 23, 59), wed), "yesterday");
    assert.equal(sectionFor(local(9, 0, 0), wed), "week", "Monday 00:00 starts the week");
    assert.equal(sectionFor(local(8, 23, 59), wed), "earlier", "Sunday is last week");
    assert.equal(sectionFor(null, wed), "earlier");
    assert.equal(sectionFor(local(12, 9), wed), "today", "a skewed future time is still today");
});

test("on a Monday, yesterday is Yesterday rather than Earlier", () => {
    assert.equal(sectionFor(local(8, 12), NOW), "yesterday");
    assert.equal(sectionFor(local(7, 12), NOW), "earlier");
    assert.equal(startOfWeek(NOW), new Date(2026, 10, 9).getTime());
});

test("sections come out in order, empty ones dropped, rows kept in order", () => {
    const now = NOW.getTime();
    const rows = inboxRows(
        [item({ at: local(9, 9) }), item({ at: local(2, 9) }), item({ at: local(9, 8) })],
        "needs",
        "",
        now,
    );
    const sections = sectionRows(rows, NOW);
    assert.deepEqual(
        sections.map((s) => [s.label, s.rows.length]),
        [
            ["TODAY", 2],
            ["EARLIER", 1],
        ],
    );
});

test("the time column: a clock today, the weekday this week, a date before", () => {
    const wed = new Date(2026, 10, 11, 10, 0);
    assert.equal(rowWhen(local(11, 2, 13), wed), "2:13 AM");
    assert.equal(rowWhen(local(10, 18, 40), wed), "6:40 PM");
    assert.equal(rowWhen(local(9, 16, 25), wed), "Mon");
    assert.equal(rowWhen(local(2, 16, 25), wed), "Nov 2");
    assert.equal(fullWhen(local(11, 2, 13), wed), "Today 2:13 AM");
    assert.equal(fullWhen(local(9, 16, 25), wed), "Mon 4:25 PM");
});

/* ── why it is waiting ────────────────────────────────────────────────────── */

test("the reason chip comes from what the item carries, nothing invented", () => {
    assert.equal(reasonFor(item()), "callback");
    assert.equal(reasonFor(item({ source: "web-form", preview: null })), "web");
});

test("hung up: no summary, under 15 seconds, or Outcome says so (the Overview's rule)", () => {
    assert.equal(reasonFor(item({ preview: null })), "missed");
    assert.equal(reasonFor(item({ preview: "   " })), "missed");
    assert.equal(reasonFor(item({ durationSeconds: 9 })), "missed");
    assert.equal(reasonFor(item({ durationSeconds: 14 })), "missed");
    assert.equal(reasonFor(item({ durationSeconds: 15 })), "callback", "15s is a real call");
    assert.equal(reasonFor(item({ durationSeconds: null })), "callback", "unknown length is not short");
    assert.equal(reasonFor(item({ outcome: "Hung up" })), "missed");
    assert.equal(reasonFor(item({ outcome: "Qualified" })), "callback");
});

test("Needs you ignores read state entirely", () => {
    const now = NOW.getTime();
    assert.equal(isNeedsYou(item({ read: true }), now), true, "opened is not handled");
    assert.equal(isNeedsYou(item({ read: false, archived: true }), now), false);
    assert.equal(isNeedsYou(item({ remindAt: local(10, 7) }), now), false);
    assert.equal(isNeedsYou(item({ promoted: true }), now), false);
    // The retired "unread" view is an alias of Needs you, for callers written against it.
    const items = [item({ read: true }), item({ archived: true }), item({ remindAt: local(10, 7) })];
    assert.deepEqual(
        filterInbox(items, "unread", "", now).map((i) => i.id),
        filterInbox(items, "needs", "", now).map((i) => i.id),
    );
});

/* ── Remind me ────────────────────────────────────────────────────────────── */

test("the presets are today 6 PM, tomorrow 7 AM and next Monday 7 AM", () => {
    const tue = new Date(2026, 10, 10, 14, 30);
    const p = remindPresets(tue);
    assert.deepEqual(
        p.map((x) => x.key),
        ["today", "tomorrow", "nextweek"],
    );
    assert.equal(p[0].at.getTime(), new Date(2026, 10, 10, 18, 0).getTime());
    assert.equal(p[1].at.getTime(), new Date(2026, 10, 11, 7, 0).getTime());
    assert.equal(p[2].at.getTime(), new Date(2026, 10, 16, 7, 0).getTime());
    assert.deepEqual(
        p.map((x) => `${x.label} ${x.detail}`),
        ["Later today 6:00 PM", "Tomorrow morning 7:00 AM", "Next week Mon 7:00 AM"],
    );
});

test("after 6 PM there is no Later today", () => {
    assert.deepEqual(
        remindPresets(new Date(2026, 10, 10, 18, 0)).map((x) => x.key),
        ["tomorrow", "nextweek"],
    );
});

test("next week from a Monday is the Monday after, from a Sunday it is tomorrow", () => {
    const fromMonday = remindPresets(NOW).find((x) => x.key === "nextweek");
    assert.equal(fromMonday.at.getTime(), new Date(2026, 10, 16, 7, 0).getTime());
    const fromSunday = remindPresets(new Date(2026, 10, 15, 9, 0)).find((x) => x.key === "nextweek");
    assert.equal(fromSunday.at.getTime(), new Date(2026, 10, 16, 7, 0).getTime());
});

test("the toast says when, in the approved wording", () => {
    const tue = new Date(2026, 10, 10, 14, 30);
    assert.equal(remindToast(new Date(2026, 10, 10, 18, 0), tue), "We’ll remind you at 6 PM today");
    assert.equal(remindToast(tomorrowMorning(tue), tue), "We’ll remind you tomorrow at 7 AM");
    assert.equal(remindToast(new Date(2026, 10, 16, 7, 0), tue), "We’ll remind you Monday at 7 AM");
    assert.equal(remindToast(new Date(2026, 11, 1, 15, 30), tue), "We’ll remind you Dec 1 at 3:30 PM");
});

test("the reminded row's chip reads like the mockup's", () => {
    const mon = NOW;
    assert.equal(remindChip(new Date(2026, 10, 10, 7, 0).toISOString(), mon), "Remind Tue 7 AM");
    assert.equal(remindChip(new Date(2026, 10, 9, 18, 0).toISOString(), mon), "Remind today 6 PM");
    assert.equal(remindChip(new Date(2026, 10, 30, 7, 0).toISOString(), mon), "Remind Nov 30 7 AM");
});

test("a picked time must be in the future", () => {
    assert.equal(parsePickedTime("", NOW), null);
    assert.equal(parsePickedTime("nonsense", NOW), null);
    assert.equal(parsePickedTime("2026-11-09T09:00", NOW), null, "earlier today");
    assert.equal(parsePickedTime("2026-11-12T15:00", NOW).getTime(), new Date(2026, 10, 12, 15, 0).getTime());
});

/* ── quick replies ────────────────────────────────────────────────────────── */

test("a quick reply is greeted by first name and reads as one sentence", () => {
    assert.equal(
        prefillReply("Dave Kowalski", "On a job right now. I'll call you back by 5."),
        "Hi Dave, on a job right now. I'll call you back by 5.",
    );
    assert.equal(prefillReply("Dave", "I'm on my way."), "Hi Dave, I'm on my way.", "I stays I");
    assert.equal(prefillReply(null, "Can you send a photo of it?"), "Hi, can you send a photo of it?");
    assert.equal(greeting("(512) 555-0147"), "Hi, ", "a number is not a name");
    assert.equal(firstName("  Carol  Ostrander "), "Carol");
});

/* ── the callback line ────────────────────────────────────────────────────── */

test("how long after the form the receptionist rang", () => {
    const t = Date.parse("2026-11-09T15:00:00Z");
    const iso = (ms) => new Date(t + ms).toISOString();
    assert.equal(callbackGap(iso(0), iso(41_000)), "41 seconds");
    assert.equal(callbackGap(iso(0), iso(1_000)), "1 second");
    assert.equal(callbackGap(iso(0), iso(3 * 60_000)), "3 minutes");
    assert.equal(callbackGap(iso(0), iso(-5_000)), null, "a call before the form is not its callback");
    assert.equal(callbackGap(null, iso(0)), null);
});

/* ── UI rules, at the source ──────────────────────────────────────────────── */

const read = (p) => readFileSync(new URL(`../app/components/portal/${p}`, import.meta.url), "utf8");

test("the tour anchors are still there", () => {
    const src = ["InboxSection.tsx", "inbox/InboxToolbar.tsx", "inbox/LeadDetail.tsx"].map(read).join("\n");
    for (const anchor of ["inbox-list", "inbox-filters", "inbox-promote"]) {
        assert.match(src, new RegExp(`data-tour="${anchor}"`), anchor);
    }
});

test("keyboard shortcuts ignore typing and modifiers, and leave with the component", () => {
    const src = read("InboxSection.tsx");
    assert.match(src, /if \(e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey\) return;/);
    assert.match(src, /INPUT\|TEXTAREA\|SELECT/);
    assert.match(src, /isContentEditable/);
    assert.match(src, /return \(\) => window\.removeEventListener\("keydown", onKey\)/);
    assert.match(src, /if \(!isDesktop\) return;/, "phones get no global key handler");
});

test("opening a lead on a phone pushes history, so Back closes it", () => {
    const src = read("InboxSection.tsx");
    assert.match(src, /openedHere\.current = true;\s*router\.push\(to/);
    assert.match(src, /router\.back\(\);/);
});

test("the swipe leaves vertical scrolling to the browser and respects reduced motion", () => {
    const src = read("inbox/SwipeRow.tsx");
    assert.match(src, /touchAction: "pan-y"/);
    assert.match(src, /useReducedMotion/);
    assert.match(src, /e\.pointerType === "mouse"/);
});

test("Archive is called Done everywhere the client can see it", () => {
    const files = [
        "InboxSection.tsx",
        "inbox/InboxList.tsx",
        "inbox/InboxToolbar.tsx",
        "inbox/LeadDetail.tsx",
        "inbox/chips.tsx",
    ];
    for (const f of files) {
        const visible = read(f)
            // Strip comments; they are free to say what the field is stored as.
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, "");
        // Case-sensitive: the stored field is `archived`, and code may say so.
        assert.doesNotMatch(visible, />[^<{]*\bArchive/, `${f} shows the word Archive`);
        assert.doesNotMatch(visible, /"Archive/, `${f} labels something Archive`);
    }
});
