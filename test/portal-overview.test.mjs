/**
 * The lead-first Overview's arithmetic: the week, after hours, callback speed, Needs you.
 *
 * Every figure on the reworked Overview is a claim to a client about their own business —
 * "14 new leads this week", "48 sec callback speed", "3 need you" — and the Inbox one click
 * away makes the same claims about the same leads. So the rules live in pure modules
 * (`app/lib/portal-overview-*.ts`) and are pinned here on fixed instants, in a fixed zone,
 * with nothing read from the clock.
 *
 * Imports the real `.ts` modules through the transpile hooks `npm test` registers.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    OVERVIEW_TIME_ZONE,
    clockLabel,
    dayIndexInWeek,
    isAfterHours,
    mondayLabel,
    partOfDay,
    sinceLabel,
    spanLabel,
    weekBounds,
    whenLabel,
    zonedParts,
} from "../app/lib/portal-overview-time.ts";
import {
    HANG_UP_MAX_SECONDS,
    callbackSpeedSeconds,
    caughtAfterHours,
    initialsOf,
    leadWeek,
    needsReason,
    needsYou,
} from "../app/lib/portal-overview-leads.ts";
import {
    followUpsDue,
    pipelineSummary,
    reviewsAskedThisWeek,
} from "../app/lib/portal-overview-pipeline.ts";
import { activityFeed } from "../app/lib/portal-overview-activity.ts";
import { overviewStatus } from "../app/lib/portal-overview-status.ts";
import { buildInbox } from "../app/lib/crm-contacts.ts";

const TZ = "America/New_York";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Wednesday Nov 11 2026, 10:30 AM Eastern (EST, UTC-5). */
const NOW = Date.parse("2026-11-11T15:30:00.000Z");
const iso = (ms) => new Date(ms).toISOString();

/** An inbox item, shaped as `buildInbox` emits it. */
function item(overrides = {}) {
    return {
        id: "rec00000000000001",
        source: "call",
        name: "Dave Kowalski",
        phone: "+15125550101",
        phoneDisplay: "(512) 555-0101",
        callbackPhone: null,
        callbackPhoneDisplay: null,
        email: null,
        preview: "Furnace quit overnight and the house is down to 58°.",
        at: iso(NOW - HOUR),
        read: false,
        promoted: false,
        archived: false,
        durationSeconds: 140,
        recordingUrl: null,
        address: null,
        outcome: null,
        callback: null,
        ...overrides,
    };
}

/* ── the week ─────────────────────────────────────────────────────────────── */

test("the week starts at Monday 00:00 in the client's zone, not UTC", () => {
    const week = weekBounds(NOW, TZ);
    // Mon Nov 9 2026, 00:00 EST = 05:00Z.
    assert.equal(iso(week.startMs), "2026-11-09T05:00:00.000Z");
    assert.equal(week.todayIndex, 2);
    assert.equal(iso(week.todayEndMs), "2026-11-12T05:00:00.000Z");
    assert.equal(week.dayStarts.length, 8);
    assert.equal(iso(week.dayStarts[7]), "2026-11-16T05:00:00.000Z");
    assert.equal(mondayLabel(week), "Mon Nov 9");
});

test("late Sunday evening Eastern is still last week, though UTC has rolled to Monday", () => {
    // Sun Nov 15, 11:30 PM EST = Mon Nov 16 04:30Z.
    const lateSunday = Date.parse("2026-11-16T04:30:00.000Z");
    const week = weekBounds(lateSunday, TZ);
    assert.equal(week.todayIndex, 6);
    assert.equal(iso(week.startMs), "2026-11-09T05:00:00.000Z");
    assert.equal(mondayLabel(week), "Mon Nov 9");
});

test("a DST week keeps every day on a real local midnight", () => {
    // US clocks fall back on Sun Nov 1 2026. Thursday Oct 29, noon EDT.
    const week = weekBounds(Date.parse("2026-10-29T16:00:00.000Z"), TZ);
    assert.equal(iso(week.startMs), "2026-10-26T04:00:00.000Z"); // Mon 00:00 EDT
    assert.equal(iso(week.dayStarts[6]), "2026-11-01T04:00:00.000Z"); // Sun 00:00 EDT
    assert.equal(iso(week.dayStarts[7]), "2026-11-02T05:00:00.000Z"); // Mon 00:00 EST
    assert.equal(week.dayStarts[7] - week.dayStarts[6], 25 * HOUR);
    assert.equal(mondayLabel(week), "Mon Oct 26");
});

test("a week that starts in the previous month labels its Monday correctly", () => {
    // Sun Nov 1 2026 → the week began Mon Oct 26.
    const week = weekBounds(Date.parse("2026-11-01T17:00:00.000Z"), TZ);
    assert.equal(mondayLabel(week), "Mon Oct 26");
});

test("last week's comparison is the same elapsed stretch, not all seven days", () => {
    const week = weekBounds(NOW, TZ);
    assert.equal(iso(week.previousStartMs), "2026-11-02T05:00:00.000Z");
    assert.equal(week.previousEndMs - week.previousStartMs, NOW - week.startMs);
});

test("dayIndexInWeek buckets by local day and rejects anything outside the week", () => {
    const week = weekBounds(NOW, TZ);
    assert.equal(dayIndexInWeek(week.startMs, week), 0);
    assert.equal(dayIndexInWeek(week.startMs - 1, week), -1);
    // Tue Nov 10, 11:59 PM EST is Tuesday, even though it is Wednesday in UTC.
    assert.equal(dayIndexInWeek(Date.parse("2026-11-11T04:59:00.000Z"), week), 1);
    assert.equal(dayIndexInWeek(week.dayStarts[7], week), -1);
});

test("labels read in the client's zone", () => {
    assert.equal(clockLabel(Date.parse("2026-11-11T07:13:00.000Z"), TZ), "2:13 AM");
    assert.equal(clockLabel(Date.parse("2026-11-11T05:00:00.000Z"), TZ), "12:00 AM");
    assert.equal(clockLabel(Date.parse("2026-11-11T17:05:00.000Z"), TZ), "12:05 PM");
    assert.equal(partOfDay(NOW, TZ), "morning");
    assert.equal(partOfDay(NOW + 3 * HOUR, TZ), "afternoon");
    assert.equal(partOfDay(NOW + 8 * HOUR, TZ), "evening");

    const yesterdayEve = Date.parse("2026-11-10T23:40:00.000Z"); // Tue 6:40 PM
    assert.equal(whenLabel(yesterdayEve, NOW, TZ), "Yesterday 6:40 PM");
    assert.equal(whenLabel(yesterdayEve, NOW, TZ, "short"), "Yesterday");
    const saturday = Date.parse("2026-11-08T00:15:00.000Z"); // Sat Nov 7, 7:15 PM
    assert.equal(whenLabel(saturday, NOW, TZ), "Sat 7:15 PM");
    assert.equal(whenLabel(saturday, NOW, TZ, "short"), "Sat");
    assert.equal(sinceLabel(saturday, NOW, TZ), "Saturday");
    assert.equal(whenLabel(NOW - 20 * DAY, NOW, TZ), "Oct 22");

    assert.equal(spanLabel(48), "48 sec");
    assert.equal(spanLabel(200), "3 min");
    assert.equal(spanLabel(2 * 86_400 + 3600), "2 days");
});

test("the fallback zone is the one documented as the data gap", () => {
    assert.equal(OVERVIEW_TIME_ZONE, "America/New_York");
    assert.equal(zonedParts(NOW, OVERVIEW_TIME_ZONE).hour, 10);
});

/* ── after hours ──────────────────────────────────────────────────────────── */

/** Mon–Fri 8–5, Sat 9–1, Sun closed. Keyed 0 = Monday. */
const WEEKDAYS_8_TO_5 = {
    0: [{ open: "08:00", close: "17:00" }],
    1: [{ open: "08:00", close: "17:00" }],
    2: [{ open: "08:00", close: "17:00" }],
    3: [{ open: "08:00", close: "17:00" }],
    4: [{ open: "08:00", close: "17:00" }],
    5: [{ open: "09:00", close: "13:00" }],
};

/** Eastern wall clock → instant, for November (EST, UTC-5). */
const est = (day, hh, mm = 0) => Date.UTC(2026, 10, day, hh + 5, mm);

test("unknown hours are null, never a default", () => {
    assert.equal(isAfterHours(NOW, null, TZ), null);
    assert.equal(isAfterHours(NOW, undefined, TZ), null);
});

test("after hours is measured against the client's own hours", () => {
    assert.equal(isAfterHours(est(11, 10, 30), WEEKDAYS_8_TO_5, TZ), false); // Wed 10:30
    assert.equal(isAfterHours(est(11, 7, 59), WEEKDAYS_8_TO_5, TZ), true); // Wed 7:59
    assert.equal(isAfterHours(est(11, 8, 0), WEEKDAYS_8_TO_5, TZ), false); // opens inclusive
    assert.equal(isAfterHours(est(11, 17, 0), WEEKDAYS_8_TO_5, TZ), true); // closes exclusive
    assert.equal(isAfterHours(est(14, 12, 0), WEEKDAYS_8_TO_5, TZ), false); // Sat noon
    assert.equal(isAfterHours(est(14, 14, 0), WEEKDAYS_8_TO_5, TZ), true); // Sat 2 PM
    assert.equal(isAfterHours(est(15, 12, 0), WEEKDAYS_8_TO_5, TZ), true); // Sunday, closed
});

test("an overnight span covers the evening and the next morning", () => {
    // Friday 6 PM to 2 AM Saturday, and nothing else.
    const lateFriday = { 4: [{ open: "18:00", close: "02:00" }] };
    assert.equal(isAfterHours(est(13, 17, 59), lateFriday, TZ), true); // Fri 5:59 PM
    assert.equal(isAfterHours(est(13, 23, 0), lateFriday, TZ), false); // Fri 11 PM
    assert.equal(isAfterHours(est(14, 1, 30), lateFriday, TZ), false); // Sat 1:30 AM
    assert.equal(isAfterHours(est(14, 2, 0), lateFriday, TZ), true); // Sat 2:00 AM
    // The spill belongs to Friday's span only: Thursday night stays closed.
    assert.equal(isAfterHours(est(13, 1, 0), lateFriday, TZ), true); // Fri 1 AM
});

test("24/7 and split days", () => {
    const allDay = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ open: "00:00", close: "24:00" }]]));
    assert.equal(isAfterHours(est(11, 3, 0), allDay, TZ), false);
    assert.equal(isAfterHours(est(15, 23, 59), allDay, TZ), false);

    const split = { 2: [{ open: "07:00", close: "11:00" }, { open: "13:00", close: "18:00" }] };
    assert.equal(isAfterHours(est(11, 12, 0), split, TZ), true); // lunch
    assert.equal(isAfterHours(est(11, 14, 0), split, TZ), false);
});

test("a malformed span is ignored rather than thrown on", () => {
    const bad = { 2: [{ open: "9am", close: "5pm" }, { open: "08:00", close: "17:00" }] };
    assert.equal(isAfterHours(est(11, 10, 0), bad, TZ), false);
    assert.equal(isAfterHours(est(11, 20, 0), bad, TZ), true);
});

test("with hours unknown, the week card and tile hide their after-hours figure", () => {
    const week = weekBounds(NOW, TZ);
    const items = [item({ at: iso(est(11, 2, 13)) })];
    assert.equal(leadWeek(items, week, { hours: null, timeZone: TZ }).afterHours, null);
    assert.equal(caughtAfterHours(items, week, { hours: null, timeZone: TZ }), null);
    assert.equal(needsYou(items, { timeZone: TZ }).rows[0].afterHours, null);
});

test("with hours known, after-hours counts calls outside them", () => {
    const week = weekBounds(NOW, TZ);
    const items = [
        item({ id: "a", at: iso(est(11, 2, 13)) }), // Wed 2:13 AM, after hours
        item({ id: "b", phone: "+15125550102", at: iso(est(10, 10, 0)) }), // Tue 10 AM
        item({ id: "c", source: "web-form", phone: "+15125550103", at: iso(est(9, 22, 0)) }), // web, Mon 10 PM
    ];
    const opts = { hours: WEEKDAYS_8_TO_5, timeZone: TZ };
    assert.equal(leadWeek(items, week, opts).afterHours, 2); // a lead is a lead, either channel
    assert.equal(caughtAfterHours(items, week, opts), 1); // only calls were "caught"
    const row = needsYou(items, opts).rows.find((r) => r.id === "contact:+15125550101");
    assert.equal(row.afterHours, true);
});

/* ── callback speed ───────────────────────────────────────────────────────── */

const LEAD_PHONE = "+15125550147";

function webLead(leadId, createdAt) {
    return {
        leadId,
        name: "Carol Ostrander",
        phone: LEAD_PHONE,
        phoneRaw: "512-555-0147",
        email: null,
        message: "A quote on a heat pump.",
        createdAt: iso(createdAt),
        readAt: null,
        callbackPlaced: true,
    };
}

function callRow(id, at, number = LEAD_PHONE) {
    return {
        id,
        date: iso(at),
        callerName: "Carol Ostrander",
        callerNumber: number,
        callbackNumber: null,
        summary: "Called back about a heat pump quote.",
        durationSeconds: 90,
        callType: null,
        outcome: null,
        site: null,
        email: null,
        address: null,
        recordingUrl: null,
        priority: null,
        smsConsent: null,
    };
}

test("callback speed averages form-to-callback gaps on this week's enquiries", () => {
    const week = weekBounds(NOW, TZ);
    const t1 = est(10, 9, 0);
    const t2 = est(11, 9, 0);
    const items = buildInbox({
        calls: [callRow("recCallbackAAAAAA1", t1 + 40_000), callRow("recCallbackAAAAAA2", t2 + 56_000, "+15125550148")],
        leads: [webLead("one", t1), { ...webLead("two", t2), phone: "+15125550148" }],
    });
    // Both calls were folded into their enquiries rather than listed on their own.
    assert.equal(items.length, 2);
    assert.equal(callbackSpeedSeconds(items, week), 48);
});

test("callback speed ignores enquiries with no callback, and last week's", () => {
    const week = weekBounds(NOW, TZ);
    const lastWeek = est(4, 9, 0);
    const items = buildInbox({
        calls: [callRow("recCallbackAAAAAA3", lastWeek + 30_000)],
        leads: [webLead("old", lastWeek), { ...webLead("fresh", est(11, 9, 0)), phone: "+15125550199" }],
    });
    assert.equal(callbackSpeedSeconds(items, week), null);
});

/* ── needs you ────────────────────────────────────────────────────────────── */

test("needs you is the Inbox worklist: not read, not done, not promoted", () => {
    const items = [
        item({ id: "keep", phone: "+15125550111" }),
        item({ id: "read", phone: "+15125550112", read: true }),
        item({ id: "done", phone: "+15125550113", archived: true }),
        item({ id: "promoted", phone: "+15125550114", promoted: true }),
    ];
    const n = needsYou(items, { timeZone: TZ });
    assert.equal(n.total, 1);
    assert.deepEqual(n.rows.map((r) => r.id), ["contact:+15125550111"]);
});

test("needs you is newest first, capped, and counts every row", () => {
    const items = Array.from({ length: 7 }, (_, i) =>
        item({ id: `r${i}`, phone: `+1512555020${i}`, at: iso(NOW - i * HOUR) }),
    );
    const n = needsYou(items, { timeZone: TZ });
    assert.equal(n.total, 7);
    assert.deepEqual(
        n.rows.map((r) => r.id),
        [0, 1, 2, 3, 4].map((i) => `contact:+1512555020${i}`),
    );
    assert.equal(n.oldest.at, iso(NOW - 6 * HOUR));
});

test("a repeat caller is one row, speaking for the call that left a message", () => {
    const phone = "+15125550147";
    const items = [
        item({ id: "late", phone, preview: null, durationSeconds: 6, at: iso(NOW - HOUR) }),
        item({ id: "early", phone, preview: "Two heads broken by the driveway.", at: iso(NOW - 3 * HOUR) }),
    ];
    const n = needsYou(items, { timeZone: TZ });
    assert.equal(n.total, 1);
    const [row] = n.rows;
    assert.equal(row.count, 2);
    assert.equal(row.at, iso(NOW - HOUR));
    assert.equal(row.reason, "callback");
    assert.equal(row.preview, "Two heads broken by the driveway.");
});

test("the Call back button dials the number they asked for, else theirs", () => {
    const asked = needsYou(
        [item({ callbackPhone: "+15125550999", callbackPhoneDisplay: "(512) 555-0999" })],
        { timeZone: TZ },
    );
    assert.equal(asked.rows[0].dialNumber, "+15125550999");
    assert.equal(needsYou([item()], { timeZone: TZ }).rows[0].dialNumber, "+15125550101");
    assert.equal(needsYou([item({ phone: null })], { timeZone: TZ }).rows[0].dialNumber, null);
});

test("reason chips come from real fields", () => {
    assert.equal(needsReason(item({ source: "web-form", preview: null })), "web");
    assert.equal(needsReason(item()), "callback");
    assert.equal(needsReason(item({ preview: "  " })), "hung-up");
    assert.equal(needsReason(item({ durationSeconds: HANG_UP_MAX_SECONDS - 1 })), "hung-up");
    assert.equal(needsReason(item({ durationSeconds: HANG_UP_MAX_SECONDS })), "callback");
    // A missing duration is our gap, not a short call.
    assert.equal(needsReason(item({ durationSeconds: null })), "callback");
    assert.equal(needsReason(item({ outcome: "Hung up" })), "hung-up");
});

test("initials", () => {
    assert.equal(initialsOf("Dave Kowalski"), "DK");
    assert.equal(initialsOf("priya"), "P");
    assert.equal(initialsOf("Mary Ann  O'Neil"), "MO");
    assert.equal(initialsOf(null), "?");
    assert.equal(initialsOf("(512) 555"), "?");
});

/* ── this week ────────────────────────────────────────────────────────────── */

test("the week card counts every item that arrived, by channel and by day", () => {
    const week = weekBounds(NOW, TZ);
    const items = [
        item({ id: "a", at: iso(est(9, 9, 0)) }), // Mon
        item({ id: "b", at: iso(est(9, 15, 0)), archived: true }), // Mon, done — still a lead
        item({ id: "c", source: "web-form", at: iso(est(11, 7, 0)), promoted: true }), // Wed
        item({ id: "d", at: iso(est(4, 9, 0)) }), // last Wednesday, inside the comparison span
        item({ id: "e", at: iso(est(6, 9, 0)) }), // last Friday, outside it
    ];
    const w = leadWeek(items, week, { timeZone: TZ });
    assert.equal(w.total, 3);
    assert.equal(w.previousTotal, 1);
    assert.deepEqual(w.perDay, [2, 0, 1, 0, 0, 0, 0]);
    assert.equal(w.calls, 2);
    assert.equal(w.web, 1);
    assert.equal(w.handled, 2);
});

/* ── pipeline ─────────────────────────────────────────────────────────────── */

function customer(overrides = {}) {
    return {
        customerId: "c1",
        name: "Ana Ruiz",
        phone: "+15125550300",
        stage: "lead",
        value: null,
        archived: false,
        stageChangedAt: iso(NOW - 10 * DAY),
        reviewSent: null,
        stale: false,
        ...overrides,
    };
}

test("pipeline counts open stages now and Won since Monday, with dollars only where typed", () => {
    const week = weekBounds(NOW, TZ);
    const s = pipelineSummary(
        [
            customer({ customerId: "a" }),
            customer({ customerId: "b", stage: "quoted", value: 1000, stale: true }),
            customer({ customerId: "c", stage: "quoted", value: 500 }),
            customer({ customerId: "d", stage: "won", value: 2140, stageChangedAt: iso(NOW - DAY) }),
            customer({ customerId: "e", stage: "won", value: 9000 }), // won weeks ago
            customer({ customerId: "f", stage: "contacted", archived: true, stale: true }),
            customer({ customerId: "g", stage: "lost" }),
        ],
        week,
    );
    assert.deepEqual(s.open.lead, { count: 1, value: null });
    assert.deepEqual(s.open.quoted, { count: 2, value: 1500 });
    assert.deepEqual(s.open.contacted, { count: 0, value: null });
    assert.deepEqual(s.wonThisWeek, { count: 1, value: 2140 });
    assert.equal(s.goingQuiet, 1);
    const total = s.shares.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
    assert.equal(s.shares[0], 0); // Lead has no dollars, so no width
});

test("follow-ups due today include overdue, skip undated and done, earliest first", () => {
    const week = weekBounds(NOW, TZ);
    const customers = [customer({ customerId: "c1" }), customer({ customerId: "gone", archived: true })];
    const due = followUpsDue(
        [
            { taskId: "t1", customerId: "c1", title: "Call back Thursday", dueAt: iso(est(11, 16, 0)), done: false },
            { taskId: "t2", customerId: "c1", title: "Send the quote to Carol", dueAt: iso(est(6, 9, 0)), done: false },
            { taskId: "t3", customerId: "c1", title: "Tomorrow", dueAt: iso(est(12, 9, 0)), done: false },
            { taskId: "t4", customerId: "c1", title: "No date", dueAt: null, done: false },
            { taskId: "t5", customerId: "c1", title: "Done already", dueAt: iso(est(10, 9, 0)), done: true },
            { taskId: "t6", customerId: "gone", title: "Archived customer", dueAt: iso(est(10, 9, 0)), done: false },
        ],
        customers,
        week.todayEndMs,
    );
    assert.equal(due.count, 2);
    assert.deepEqual(due.first, { title: "Send the quote to Carol", customerId: "c1" });
});

test("reviews asked counts sends since Monday", () => {
    const week = weekBounds(NOW, TZ);
    assert.equal(
        reviewsAskedThisWeek(
            [
                customer({ reviewSent: { sentAt: iso(NOW - DAY) } }),
                customer({ reviewSent: { sentAt: iso(NOW - 9 * DAY) } }),
                customer(),
            ],
            week,
        ),
        1,
    );
});

/* ── activity ─────────────────────────────────────────────────────────────── */

test("activity merges sources newest first, in the approved wording", () => {
    const items = [
        item({ id: "call1", at: iso(NOW - HOUR) }),
        item({ id: "web1", source: "web-form", name: "Priya Nair", phone: "+15125550500", at: iso(NOW - 2 * HOUR) }),
    ];
    const events = activityFeed({
        items,
        customers: [customer({ customerId: "w", stage: "won", value: 2140, stageChangedAt: iso(NOW - 3 * HOUR) })],
        texts: [{ id: "m1", customerId: "w", body: "Tuesday at 9 works, thanks.", at: iso(NOW - 30 * MIN) }],
        showValues: true,
    });
    assert.deepEqual(
        events.map((e) => e.title),
        [
            "Ana Ruiz texted back",
            "Your receptionist answered Dave Kowalski",
            "New web enquiry from Priya Nair",
            "Ana Ruiz moved to Won · $2,140",
        ],
    );
    assert.equal(events[0].detail, "“Tuesday at 9 works, thanks.”");
});

test("dollar values stay off the feed unless asked for", () => {
    const events = activityFeed({
        items: [],
        customers: [customer({ stage: "won", value: 2140, stageChangedAt: iso(NOW - HOUR) })],
        showValues: false,
    });
    assert.equal(events[0].title, "Ana Ruiz moved to Won");
});

test("marking a grouped row done is one feed line, not one per call", () => {
    const phone = "+15125550600";
    const items = [
        item({ id: "x1", name: "Tom Becker", phone, archived: true, at: iso(NOW - 2 * DAY) }),
        item({ id: "x2", name: "Tom Becker", phone, archived: true, at: iso(NOW - 3 * DAY) }),
    ];
    const events = activityFeed({
        items,
        done: [
            { id: "x1", at: iso(NOW - HOUR) },
            { id: "x2", at: iso(NOW - HOUR + 200) },
        ],
        showValues: false,
    });
    const done = events.filter((e) => e.kind === "done");
    assert.equal(done.length, 1);
    assert.equal(done[0].title, "You marked Tom Becker done");
});

/* ── status line ──────────────────────────────────────────────────────────── */

function infra(siteState) {
    return {
        site: { state: siteState, url: null, status: null, ms: null },
        deploy: { state: "ok", readyAt: null, raw: null, commitMessage: null },
        domain: { state: "ok", name: null, verified: null },
        credentialsConfigured: true,
        fetchedAt: NOW,
    };
}

test("the status line says 'working normally' only on evidence", () => {
    const ready = { state: "ready" };
    assert.deepEqual(overviewStatus(infra("ok"), 95, ready), {
        tone: "ok",
        text: "Website and receptionist working normally",
    });
    assert.equal(overviewStatus(infra("unknown"), 95, ready), null);
    assert.equal(overviewStatus(infra("ok"), 95, { state: "not-on-plan" }), null);
    assert.equal(overviewStatus(null, 95, ready), null);
    assert.equal(overviewStatus(infra("ok"), 30, ready).text, "Your website is slow to load today · see Analytics");
    assert.equal(overviewStatus(infra("down"), 95, ready).tone, "warn");
});

/* ── the page itself (source-level guards) ────────────────────────────────── */

test("the Overview stops drawing site health, visitors and billing, and keeps its lifecycle branches", () => {
    const page = readFileSync("app/portal/(dash)/page.tsx", "utf8");
    // Moved to Analytics / Settings (PR A). The components stay; the Overview no longer draws them.
    // `HealthStripSkeleton` stays: the building branch still uses it as its fallback.
    for (const gone of [
        /<HealthStrip\b(?!Skeleton)/,
        /<OverviewAside\b/,
        /<OverviewMetrics\b/,
        /<LatestCalls\b/,
        /getTrafficData/,
        /getBillingSummary/,
    ]) {
        assert.doesNotMatch(page, gone);
    }
    // Behaviour that must not change.
    assert.match(page, /raw\.status === "pending-onboarding"[\s\S]*?redirect\(`\/portal\/onboarding\?site=/);
    for (const kept of ["<PendingSiteBanner", "<GrowthProvisioning", "<BuildProgress", "Your site is being built"]) {
        assert.ok(page.includes(kept), `page.tsx should still render ${kept}`);
    }
    // Dollars are Growth-only: the pipeline card renders only when the CRM is live.
    assert.match(page, /site\.features\.crm\.state === "ready" \? \(\s*<Suspense[\s\S]{0,80}?<PipelineBlock/);
});
