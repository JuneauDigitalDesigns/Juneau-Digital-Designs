/**
 * The Starter → Growth demo (`app/components/portal/growth-demo/`), rebuilt 2026-11-12, and again
 * 2026-11-19 for the phone app.
 *
 * 2026-11-12: five scenes, a cursor driven by the demo's own clock, and the portal's real
 * components fed sample data. 2026-11-19 (Xander, on the approved phone mockup): on a phone the
 * scenes play on the new app screens, the step box sits at the top (just below the middle while
 * the texting screen is open, at the bottom for the review), there is no top bar, the review is
 * the record's one tap and its note on both layouts, step 4 is the Timeline, and the sample data
 * is the client's own trade.
 *
 * The timing, the cursor and the words are pure (`script.ts`) and imported for real through the
 * transpile hooks `npm test` registers, as are the trade's sample data (`sample.ts`); the rules
 * about which components it draws, and that the demo never fetches, are checked at source level,
 * because there is no browser in this suite and no test account to sign in with.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
    BEATS,
    COPY,
    CURSOR,
    CURSOR_MOVE_MS,
    DURATION,
    PHONE_BEATS,
    PHONE_CURSOR,
    PHONE_TARGET,
    SCENE_COUNT,
    SEGMENTS,
    TOTAL_MS,
    announcementFor,
    captionFor,
    cursorAt,
    sceneOf,
    sceneView,
    stepOf,
    tick,
} from "../app/components/portal/growth-demo/script.ts";
import { boardRows, daveTimeline, demoNow, inboxItems, recordData } from "../app/components/portal/growth-demo/sample.ts";
import { TRADE_SAMPLES, tradeSample } from "../app/data/trade-samples.ts";
import { CARRIER_LINE, DEMO_STEPS } from "../app/data/portal-demo.ts";

const DIR = "app/components/portal/growth-demo";
const read = (p) => readFileSync(p, "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const HVAC = tradeSample("hvac");
const phone = (n, ms, extra = {}) => sceneView(n, ms, { phone: true, sms: HVAC.sms, ...extra });
const desk = (n, ms, extra = {}) => sceneView(n, ms, { sms: HVAC.sms, ...extra });

/* ── the sequence ─────────────────────────────────────────────────────── */

test("intro, then a title card before each of the five scenes, then the end card", () => {
    assert.equal(SCENE_COUNT, 5);
    assert.deepEqual([...SEGMENTS], ["intro", "scrim1", "s1", "scrim2", "s2", "scrim3", "s3", "scrim4", "s4", "scrim5", "s5", "end"]);
    assert.deepEqual(SEGMENTS.map(sceneOf), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, null]);
    assert.deepEqual(SEGMENTS.map(stepOf), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
});

test("the approved timings: Promote 10.5s, Jobs 18.5s, Timeline 19.5s, Review 13s, the rest as before", () => {
    assert.deepEqual(
        { ...DURATION },
        { intro: 5000, scrim1: 4000, s1: 10500, scrim2: 4000, s2: 14000, scrim3: 4000, s3: 18500, scrim4: 4000, s4: 19500, scrim5: 4000, s5: 13000 },
    );
    assert.equal(TOTAL_MS, 100_500);
});

test("the clock advances one part at a time and stops on the end card", () => {
    let at = { i: 0, t: 0 };
    let steps = 0;
    const seen = [0];
    while (SEGMENTS[at.i] !== "end" && steps < 20_000) {
        at = tick(at.i, at.t, 100);
        if (seen[seen.length - 1] !== at.i) seen.push(at.i);
        steps++;
    }
    assert.deepEqual(seen, SEGMENTS.map((_, i) => i), "visits every part in order");
    assert.equal(steps, Math.ceil(TOTAL_MS / 100), "at real speed it takes the full duration");
    assert.deepEqual(tick(at.i, 0, 60_000), at, "the end card waits for the client");
});

test("a long stall lands on the next part rather than skipping a scene", () => {
    assert.deepEqual(tick(2, 0, 10 * 60_000), { i: 3, t: 0 });
});

/* ── the desktop's scenes ─────────────────────────────────────────────── */

test("desktop 1: the lead opens, is promoted, and stays open on Promoted", () => {
    assert.equal(desk(1, 0).leadOpen, false);
    assert.equal(desk(1, BEATS.s1.open).leadOpen, true);
    assert.equal(desk(1, BEATS.s1.promoting).promoting, true);
    const done = desk(1, BEATS.s1.promoted);
    assert.deepEqual([done.leadOpen, done.promoting, done.promoted], [true, false, true]);
});

test("desktop 2: Dave is lifted and moves Lead → Contacted → Quoted → Scheduled, then is dropped", () => {
    const stages = [];
    for (let ms = 0; ms < DURATION.s2; ms += 100) {
        const d = desk(2, ms).daveStage;
        if (stages[stages.length - 1] !== d) stages.push(d);
    }
    assert.deepEqual(stages, [0, 1, 2, 3]);
    assert.equal(desk(2, BEATS.s2.lift).lifted, true);
    assert.equal(desk(2, BEATS.s2.drop).lifted, false);
});

test("desktop 3: the file opens, goes to Jobs, the job is added, then the calendar shows the visit", () => {
    assert.equal(desk(3, 0).view, "none");
    assert.equal(desk(3, BEATS.s3.record).view, "record");
    assert.equal(desk(3, BEATS.s3.record).tab, "timeline");
    assert.equal(desk(3, BEATS.s3.jobsTab).tab, "jobs");
    assert.equal(desk(3, BEATS.s3.jobsTab).job, false);
    assert.equal(desk(3, BEATS.s3.job).job, true);
    assert.equal(desk(3, BEATS.s3.calendar).view, "calendar");
});

test("desktop 4: the text box is clicked into, the trade's text types out and sends, and Dave replies", () => {
    assert.equal(desk(4, BEATS.s4.focus).composing, true);
    const mid = desk(4, BEATS.s4.typeFrom + 1000);
    assert.ok(mid.typed.length > 0 && HVAC.sms.startsWith(mid.typed));
    assert.equal(desk(4, BEATS.s4.sent - 1).typed, HVAC.sms, "the whole text types before it sends");
    const sent = desk(4, BEATS.s4.sent);
    assert.deepEqual([sent.sent, sent.typed, sent.composing], [true, "", false]);
    assert.equal(desk(4, BEATS.s4.reply).reply, true);
});

test("desktop 5: Won, then one tap and its note; no review window any more", () => {
    assert.equal(desk(5, BEATS.s5.won).won, true);
    assert.deepEqual([desk(5, BEATS.s5.sent - 1).reviewSent, desk(5, BEATS.s5.sent - 1).toast], [false, false]);
    assert.deepEqual([desk(5, BEATS.s5.sent).reviewSent, desk(5, BEATS.s5.sent).toast], [true, true]);
    assert.equal("reviewOpen" in desk(5, 0), false);
});

/* ── the phone's scenes (the approved mockup's beats) ─────────────────── */

test("phone: every scene opens at the top of its screen", () => {
    for (const n of [1, 2, 3, 4, 5]) assert.deepEqual(phone(n, 0).scroll, { key: `${n}:0`, to: "top" });
});

test("phone 1: Dave's lead opens full screen, scrolls down to Promote, Adding…, promoted", () => {
    const b = PHONE_BEATS.s1;
    assert.equal(phone(1, b.open - 1).leadOpen, false);
    assert.equal(phone(1, b.open).leadOpen, true);
    assert.equal(phone(1, b.scroll).scroll.to, "end");
    assert.ok(b.scroll < b.promoting, "Promote is on screen before it is tapped");
    assert.equal(phone(1, b.promoting).promoting, true);
    const done = phone(1, b.promoted);
    assert.deepEqual([done.promoting, done.promoted], [false, true]);
});

test("phone 2: press and hold opens the Stage sheet; Lead → Contacted → Quoted → Scheduled; then the quiet one", () => {
    const b = PHONE_BEATS.s2;
    const stages = [];
    let sheets = 0;
    let open = false;
    for (let ms = 0; ms < DURATION.s2; ms += 50) {
        const v = phone(2, ms);
        if (stages[stages.length - 1] !== v.daveStage) stages.push(v.daveStage);
        if (v.stageSheet && !open) sheets++;
        open = v.stageSheet;
    }
    assert.deepEqual(stages, [0, 1, 2, 3]);
    assert.equal(sheets, 3, "one sheet per move");
    assert.equal(phone(2, b.quiet - 1).quiet, false);
    assert.equal(phone(2, b.quiet).quiet, true);
    assert.ok(b.quiet < DURATION.s2);
});

test("phone 3: record → Jobs → Add a job → Add to calendar → back → the Calendar tab", () => {
    const b = PHONE_BEATS.s3;
    assert.equal(phone(3, 0).view, "none");
    assert.equal(phone(3, b.record).view, "record");
    assert.equal(phone(3, b.jobsTab).tab, "jobs");
    assert.deepEqual([phone(3, b.job).job, phone(3, b.job).visit], [true, false]);
    assert.equal(phone(3, b.visit).visit, true);
    assert.equal(phone(3, b.back).view, "none", "back to Customers, as the app goes");
    assert.equal(phone(3, b.calendar).view, "calendar");
    assert.equal(phone(3, b.calendar + 400).scroll.to, '[data-tour="cal-day"]', "down to today's list");
});

test("phone 4: the Timeline, the text bar, the texting screen with the box mid-screen, and back", () => {
    const b = PHONE_BEATS.s4;
    const start = phone(4, PHONE_BEATS.caption);
    assert.deepEqual([start.captionAt, start.captionPhase, start.tab, start.view], ["top", null, "timeline", "record"]);
    assert.equal(phone(4, b.down).scroll.to, '[data-tour="crm-drawer-timeline"]');
    assert.equal(phone(4, b.end).scroll.to, "end");
    assert.equal(phone(4, b.bar).barLit, true);
    assert.deepEqual([phone(4, b.top).barLit, phone(4, b.top).scroll.to], [false, "top"]);
    const thread = phone(4, b.thread);
    assert.deepEqual([thread.thread, thread.captionAt, thread.captionPhase], [true, "mid", "4b"]);
    for (const ts of Object.values(TRADE_SAMPLES)) {
        const v = sceneView(4, b.sending - 1, { phone: true, sms: ts.sms });
        assert.equal(v.typed, ts.sms, `${ts.trade}: the whole text types before Send`);
    }
    assert.deepEqual([phone(4, b.sending).sending, phone(4, b.sending).typed], [true, ""]);
    assert.deepEqual([phone(4, b.delivered).sending, phone(4, b.delivered).delivered], [false, true]);
    assert.equal(phone(4, b.reply).reply, true);
    const back = phone(4, b.back);
    assert.deepEqual([back.thread, back.captionAt, back.captionPhase], [false, "top", null]);
    assert.equal(phone(4, b.settle).scroll.to, '[data-tour="crm-drawer-timeline"]', "both texts on the timeline");
    assert.ok(b.settle < DURATION.s4);
});

test("phone 5: the box at the bottom, Won, the Review button lit, one tap, then its note", () => {
    const b = PHONE_BEATS.s5;
    assert.equal(phone(5, 0).captionAt, "bottom");
    assert.equal(phone(5, b.top).scroll.to, "top");
    assert.equal(phone(5, b.sheet).stageSheet, true);
    assert.deepEqual([phone(5, b.won).stageSheet, phone(5, b.won).won], [false, true]);
    assert.equal(phone(5, b.lit).reviewLit, true);
    const sent = phone(5, b.sent);
    assert.deepEqual([sent.reviewLit, sent.reviewSent, sent.toast], [false, true, true]);
});

test("reduced motion draws every scene as its finished frame, with no cursor", () => {
    const d = [1, 2, 3, 4, 5].map((n) => desk(n, 0, { still: true }));
    assert.equal(d[0].promoted, true);
    assert.equal(d[1].daveStage, 3);
    assert.equal(d[2].view, "calendar");
    assert.deepEqual([d[3].sent, d[3].reply, d[3].typed], [true, true, ""]);
    assert.deepEqual([d[4].won, d[4].reviewSent, d[4].toast], [true, true, true]);
    const p = [1, 2, 3, 4, 5].map((n) => phone(n, 0, { still: true }));
    assert.deepEqual([p[0].leadOpen, p[0].promoted], [true, true]);
    assert.deepEqual([p[1].daveStage, p[1].stageSheet], [3, false]);
    assert.equal(p[2].view, "calendar");
    assert.deepEqual([p[3].thread, p[3].reply, p[3].captionAt], [false, true, "top"]);
    assert.deepEqual([p[4].won, p[4].toast, p[4].captionAt], [true, true, "bottom"]);
    for (const n of [1, 2, 3, 4, 5]) {
        assert.equal(cursorAt(n, 5000, true).to, null);
        assert.equal(cursorAt(n, 5000, true, true).to, null);
    }
});

/* ── the cursor and the finger ────────────────────────────────────────── */

test("the desktop cursor clicks just before each thing it causes happens", () => {
    const clickAt = (n, sel) => CURSOR[n].find((s) => s.click && s.to === sel).at;
    assert.ok(clickAt(1, '[data-tour="inbox-promote"]') <= BEATS.s1.promoting);
    assert.ok(clickAt(3, "#crm-tab-jobs") <= BEATS.s3.jobsTab);
    assert.ok(clickAt(3, '[data-tour="crm-jobs-add"]') <= BEATS.s3.job);
    assert.ok(clickAt(3, '[data-tour="crm-job-calendar"]') <= BEATS.s3.calendar);
    assert.ok(clickAt(4, '[data-demo="send"]') <= BEATS.s4.sent);
    assert.ok(clickAt(5, '[data-tour="crm-drawer-review"]') <= BEATS.s5.sent);
    // Rows are keyed `{status}:contact:{e164}`, so a bare id never matched Dave's row.
    assert.match(CURSOR[1][0].to, /contact:\+15125550129"\]$/);
});

test("the phone's finger presses just before each thing it causes, on the new screens' hooks", () => {
    const P = PHONE_BEATS;
    const T = PHONE_TARGET;
    const press = (n, sel, after = 0) => PHONE_CURSOR[n].find((s) => s.click && s.to === sel && s.at >= after).at;
    const pairs = [
        [1, T.inboxRow, P.s1.open],
        [1, T.promote, P.s1.promoting],
        [3, T.daveCard, P.s3.record],
        [3, T.jobsTab, P.s3.jobsTab],
        [3, T.addJob, P.s3.job],
        [3, T.addToCalendar, P.s3.visit],
        [3, T.back, P.s3.back],
        [3, T.calendarTab, P.s3.calendar],
        [4, T.text, P.s4.thread],
        [4, T.send, P.s4.sending],
        [4, T.threadBack, P.s4.back],
        [5, T.stagePill, P.s5.sheet],
        [5, T.stageOption("won"), P.s5.won],
        [5, T.review, P.s5.sent],
    ];
    for (const [n, sel, beat] of pairs) {
        const at = press(n, sel);
        assert.ok(at < beat && beat - at <= 400, `scene ${n} ${sel}: pressed at ${at}, happens at ${beat}`);
    }
    // Scene 2 is a press and hold on Dave each time, then a tap on the stage he moves to.
    P.s2.moves.forEach((m, i) => {
        const held = PHONE_CURSOR[2].find((s) => s.down && s.at >= m && s.at < m + P.s2.sheetAfter);
        assert.ok(held && held.to === T.daveCard, `move ${i + 1} is held on Dave as the sheet opens`);
        const pick = press(2, T.stageOption(["contacted", "quoted", "scheduled"][i]), m);
        assert.ok(pick < m + P.s2.pickAfter);
    });
    // Pointed at, never pressed: the text bar (Text above it opens the conversation).
    assert.equal(PHONE_CURSOR[4].some((s) => s.to === T.textBar && (s.click || s.down)), false);
});

test("the cursor glides between stops, holds while dragging, and every scene's stops are in order", () => {
    const first = CURSOR[1][0];
    assert.equal(cursorAt(1, first.at - 1).to, null, "nothing before the first stop");
    const moving = cursorAt(1, CURSOR[1][2].at + CURSOR_MOVE_MS / 2);
    assert.ok(moving.p > 0 && moving.p < 1);
    assert.equal(cursorAt(1, CURSOR[1][2].at + CURSOR_MOVE_MS).p, 1);
    assert.equal(cursorAt(2, BEATS.s2.moves[0] + 100).down, true);
    assert.equal(cursorAt(1, 9000).clicks, 2);
    for (const stops of [CURSOR, PHONE_CURSOR]) {
        for (const n of [1, 2, 3, 4, 5]) {
            const at = stops[n].map((s) => s.at);
            assert.deepEqual(at, [...at].sort((a, b) => a - b), `scene ${n}'s stops are in order`);
            assert.ok(at[at.length - 1] < DURATION[`s${n}`], `scene ${n}'s cursor leaves before it ends`);
        }
    }
});

/* ── the words ────────────────────────────────────────────────────────── */

test("the approved words, 2026-11-19", () => {
    assert.equal(COPY.scrims.intro.sub, "Watch a lead become a customer you never lose track of.");
    assert.equal(COPY.scrims.intro.subPhone, undefined, "phone and desktop share it");
    assert.deepEqual(
        [1, 2, 3, 4, 5].map((n) => COPY.scrims[`scrim${n}`].title),
        ["Turn a lead into a customer", "Work the job", "Book the visit", "Timeline", "Ask for the review"],
    );
    assert.equal(COPY.scrims.scrim4.sub, "Your customer, from lead to now.");
    assert.equal(
        captionFor(2, { phone: true }).text,
        "Move Dave along as the job moves: Lead, Contacted, Quoted, Scheduled. Press and hold to change his stage. Anyone going quiet gets an orange dot.",
    );
    assert.equal(captionFor(2).text, "Drag Dave along as the job moves: Lead, Contacted, Quoted, Scheduled. Anyone going quiet gets an amber dot.", "desktop keeps the drag");
    for (const opts of [{}, { phone: true }]) {
        assert.equal(captionFor(4, opts).title, "Timeline");
        assert.equal(captionFor(4, opts).text, "Keep track of everything you've done for a customer and message them all in one place.");
        assert.equal(
            captionFor(5, opts).text,
            "When the job is done, one tap sends them a Google review request. Want to change what it says? Set your Review message in More.",
        );
    }
    assert.equal(
        captionFor(4, { phone: true, phase: "4b" }).text,
        "Or tap Text for the whole conversation. Your texts go out from your business number, and the replies land on the timeline too.",
    );
    assert.equal(captionFor(4, { phase: "4b" }).text, captionFor(4).text, "the second text is the phone's alone");
    assert.equal(captionFor(3).text, "Open Dave's file and add the job: the service, its status and what it's worth. Add to calendar books the visit.");
    assert.equal(COPY.reviewSent, "Review request sent!");
    assert.match(read("app/components/portal/crm/CustomerRecord.tsx"), /"Review request sent!"/, "the same words as the portal's own note");
});

test("the phone's step box says it is sample data; the desktop's top bar already does", () => {
    for (const n of [1, 2, 3, 4, 5]) {
        assert.equal(captionFor(n, { phone: true }).step, `STEP ${n} OF 5 · SAMPLE DATA`);
        assert.equal(captionFor(n).step, `STEP ${n} OF 5`);
    }
    assert.equal(COPY.tag, "GROWTH DEMO · SAMPLE DATA");
    assert.deepEqual([1, 2, 3, 4, 5].map((n) => captionFor(n).gate), [null, null, null, CARRIER_LINE, CARRIER_LINE]);
});

test("no dashes in any of the demo's words or in any trade's sample texts", () => {
    assert.doesNotMatch(JSON.stringify(COPY), /[–—]/);
    for (const ts of Object.values(TRADE_SAMPLES)) assert.doesNotMatch(`${ts.sms} ${ts.reply} ${ts.job.service}`, /[–—]/, ts.trade);
});

test("every part but the end card is announced, the phone's own words on a phone", () => {
    for (const seg of SEGMENTS) {
        if (seg === "end") assert.equal(announcementFor(seg), "");
        else assert.ok(announcementFor(seg).length > 10, seg);
    }
    assert.match(announcementFor("scrim2"), /^STEP 2 OF 5\. Work the job\./);
    assert.ok(announcementFor("s4").endsWith(CARRIER_LINE));
    assert.match(announcementFor("s2", { phone: true }), /Press and hold to change his stage\./);
    assert.match(announcementFor("s4", { phone: true, phase: "4b" }), /^Timeline\. Or tap Text for the whole conversation\./);
    assert.match(announcementFor("scrim1", { phone: true }), /Your receptionist answered Dave at 2:13 AM\.$/);
});

/* ── the trade's own sample data ──────────────────────────────────────── */

test("the demo plays on the client's trade: its business, Dave's call, its board, its job and its texts", () => {
    const now = demoNow(new Date(2026, 10, 19, 15, 0));
    for (const ts of Object.values(TRADE_SAMPLES)) {
        const items = inboxItems(ts, now, false, false);
        assert.equal(items[0].preview, ts.lead.preview, ts.trade);
        assert.deepEqual(items.slice(1).map((i) => i.preview), ts.inbox.map((r) => r.preview));
        assert.deepEqual(boardRows(ts, now).map((r) => r.tags[0]), ["lead", "contacted", "quoted", "scheduled"].flatMap((k) => ts.board[k].map((c) => c.tags[0])));
        const rec = recordData(ts, phone(5, DURATION.s5), now);
        assert.equal(rec.jobs[0].service, ts.job.service);
        assert.equal(rec.customer.value, ts.job.amount);
        assert.deepEqual(rec.timeline.filter((e) => e.kind.startsWith("sms")).map((e) => e.meta.body).sort(), [ts.sms, ts.reply].sort());
    }
    // HVAC is the homepage's shop, unchanged.
    assert.equal(HVAC.business.name, "Your HVAC Co.");
});

test("the one going quiet has been quiet six days, as the phone list says", () => {
    const now = demoNow();
    const stale = boardRows(HVAC, now).filter((r) => r.stale);
    assert.equal(stale.length, 1);
    assert.ok(Date.now() - Date.parse(stale[0].lastContactAt) >= 6 * 86_400_000);
});

test("Dave's timeline is the history the portal writes: the call, his promotion, three moves, then the texts", () => {
    const ev = daveTimeline(HVAC, demoNow(), { sent: true, delivered: true, reply: true });
    assert.deepEqual(
        ev.map((e) => e.kind).sort(),
        ["call", "call", "sms-in", "sms-out", "stage-change", "stage-change", "stage-change"].sort(),
    );
    assert.equal(ev.find((e) => e.meta?.origin).summary, HVAC.lead.summary);
    assert.equal(ev.find((e) => e.id === "demo-added").actor, "client");
    assert.equal(ev.find((e) => e.kind === "sms-out").meta.status, "delivered");
});

/* ── source-level rules ───────────────────────────────────────────────── */

test("the replicas draw the portal's own components, not copies of them", () => {
    const deskSrc = read(`${DIR}/DesktopReplica.tsx`);
    for (const c of ["InboxList", "LeadDetail", "InboxToolbar", "Column", "CustomerPanel", "CustomerRecord", "MonthGrid", "DayList", "ReviewToast"]) {
        assert.match(deskSrc, new RegExp(`<${c}\\b`), c);
    }
    const phoneSrc = read(`${DIR}/PhoneReplica.tsx`);
    for (const c of ["InboxToolbar", "InboxList", "LeadDetail", "MobileCard", "Chip", "CustomerRecord", "TextThread", "MiniMonth", "DayList", "ReviewToast"]) {
        assert.match(phoneSrc, new RegExp(`<${c}\\b`), c);
    }
    assert.match(phoneSrc, /variant="sheet"/, "the phone's contact-card record");
    assert.match(phoneSrc, /label: "Home"/, "Overview is Home on the phone's tab bar");
    assert.match(read(`${DIR}/DesktopReplica.tsx`), /label: "Home"/, "and on the desktop's rail");
    assert.match(read(`${DIR}/GrowthDemo.module.css`), /\.phoneShell \{[^}]*contain: paint;/, "fixed layers stay inside the phone");
});

test("the review window is gone: no forceOpen, no reviewOpen, no ReviewRequestDialog", () => {
    assert.equal(existsSync("app/components/portal/ReviewRequestDialog.tsx"), false);
    for (const f of ["script.ts", "PhoneReplica.tsx", "DesktopReplica.tsx", "GrowthDemo.tsx"]) {
        assert.doesNotMatch(code(`${DIR}/${f}`), /reviewOpen|forceOpen|ReviewRequestDialog/, f);
    }
    assert.doesNotMatch(code("app/components/portal/crm/CustomerRecord.tsx"), /reviewOpen|forceOpen|ReviewRequestDialog/);
});

test("in the demo the real customer record fetches nothing and saves nothing", () => {
    const rec = read("app/components/portal/crm/CustomerRecord.tsx");
    assert.match(rec, /const data = demo \? demo\.data : fetched;/);
    assert.match(rec, /if \(!customerId \|\| isDemo\) return;/);
    assert.match(rec, /if \(!customerId \|\| demo\) return false;/);
    assert.match(rec, /if \(!customerId \|\| demo \|\| !draft\.trim\(\)\) return;/);
    assert.match(rec, /customer\.phone && !demo &&/, "no quick-replies fetch in the demo");
    assert.match(rec, /onClick=\{\(\) => !demo && setThreadOpen\(true\)\}/, "the demo's text bar opens nothing of the record's own");
});

test("the takeover is a real modal inside a real .portal-scope, with an inert replica", () => {
    const src = read(`${DIR}/GrowthDemo.tsx`);
    assert.match(src, /role="dialog"/);
    assert.match(src, /aria-modal="true"/);
    assert.match(src, /aria-live="polite"/);
    assert.match(src, /className=\{`portal-scope /, "the replica must read the portal's tokens");
    assert.match(src, /createPortal\(/);
    assert.match(src, /"Escape"/);
    assert.match(src, /overflow = "hidden"/, "the page behind does not scroll");
    assert.match(src, /className=\{s\.screen\} data-dim=\{scrim\} aria-hidden="true" inert/);
    assert.match(src, /className=\{s\.sizer\}[^>]*aria-hidden="true" inert/);
    assert.match(src, /PHONE_QUERY = "\(max-width: 1023px\)/, "the desktop replica needs the components' desktop layouts");
});

test("the phone takeover: no top bar, a round ✕ called Exit demo, the controls along the foot", () => {
    const src = read(`${DIR}/GrowthDemo.tsx`);
    assert.match(src, /\{phone \? \([\s\S]*?className=\{s\.xRound\} onClick=\{close\} aria-label=\{COPY\.exit\}[\s\S]*?\) : \([\s\S]*?className=\{s\.tbar\}/);
    assert.match(src, /\{phone \? phoneControls : controls\}/);
    assert.match(src, /<PhoneReplica key=\{scene\}/, "each scene mounts fresh, at the top of its screen");
    assert.match(src, /sceneView\(scene, scrim \? 0 : st\.t, \{ still: still && !scrim, phone, sms: sample\.sms \}\)/);
});

test("consecutive title cards keep the dark screen and swap only their words", () => {
    const src = read(`${DIR}/GrowthDemo.tsx`);
    // One shade for every title card, in one place in the tree: it is not unmounted between
    // intro and step 1, and only its words (the keyed card inside) change.
    assert.equal(src.match(/className=\{s\.shade\}/g).length, 1);
    assert.match(src, /<div className=\{s\.scard\} key=\{`scrim-\$\{st\.run\}`\}>/);
    assert.match(read(`${DIR}/GrowthDemo.module.css`), /\.root\[data-layout="phone"\] \.scard \{[^}]*animation: gdSwap/);
});

test("Upgrade goes where the old walkthrough went, the demo follows the site's trade, and ?demo=growth opens it once", () => {
    const src = read("app/components/portal/crm/StarterShowcase.tsx");
    assert.match(src, /<GrowthDemo upgradeUrl=\{upgradeHref\(site\.slug\)\}[^>]*trade=\{site\.sampleTrade\}/);
    assert.match(src, /DEMO_PARAM = "demo"/);
    assert.match(src, /DEMO_GROWTH = "growth"/);
    assert.match(src, /searchParams\.delete\(DEMO_PARAM\)/, "the parameter is dropped after opening");
    assert.match(src, /A short demo with sample customers\. Nothing changes on your account\./);
    assert.match(read(`${DIR}/GrowthDemo.tsx`), /trade = "hvac"/);
});

test("the Show me what Growth does for me buttons are centred and wrap evenly", () => {
    for (const f of ["app/components/portal/crm/StarterShowcase.tsx", "app/components/portal/calendar/CalendarStarter.tsx", "app/components/portal/overview/PipelineCard.tsx"]) {
        assert.match(read(f), /<span className="text-center" style=\{\{ textWrap: "balance" \}\}>Show me what Growth does for me<\/span>/, f);
    }
});

test("the driver.js walkthrough is gone, and the first-run tour keeps its theme", () => {
    assert.equal(existsSync("app/components/portal/tour/showcase.ts"), false);
    assert.doesNotMatch(read("app/components/portal/crm/StarterShowcase.tsx"), /runGrowthShowcase|tour\/showcase/);
    assert.match(read("app/components/portal/tour/TourController.tsx"), /import "\.\/tour-theme\.css";/);
});

test("the cursor and the taps scroll only inside the replica, never the page (2026-11-18)", () => {
    const src = code(`${DIR}/DemoCursor.tsx`);
    assert.doesNotMatch(src, /scrollIntoView\(/, "scrollIntoView also scrolls the page the demo sits in");
    assert.match(src, /revealWithin\(target, box\)/);
    // The texting screen's own scrollIntoView is turned into a scroll of its list.
    assert.match(read(`${DIR}/PhoneReplica.tsx`), /end\.scrollIntoView = \(\) => \{\s*list\.scrollTop = list\.scrollHeight;/);
});

/* ── the homepage's phone demo, on the same scenes ────────────────────── */

test("the homepage phone demo's windows fit the phone scenes and show each step's part", () => {
    const src = read("app/components/home/PortalDemoMobile.tsx");
    const block = src.slice(src.indexOf("const STEPS"), src.indexOf("];", src.indexOf("const STEPS")));
    const steps = [...block.matchAll(/\{ scene: (\d), from: (\d+), to: (\d+) \}/g)].map((m) => ({ scene: +m[1], from: +m[2], to: +m[3] }));
    assert.equal(steps.length, DEMO_STEPS.length);
    for (const s of steps) assert.ok(s.from < s.to && s.to <= DURATION[`s${s.scene}`], JSON.stringify(s));
    const [inbox, promote, pipeline, message, review] = steps;
    const at = (s, ms) => phone(s.scene, ms);
    assert.ok(at(inbox, inbox.to).leadOpen && !at(inbox, inbox.to).promoting, "Inbox: Dave's lead is open");
    assert.ok(!at(promote, promote.from).promoted && at(promote, promote.to).promoted, "Promote: he is promoted");
    assert.deepEqual([at(pipeline, pipeline.from).daveStage, at(pipeline, pipeline.to).daveStage], [0, 3], "Pipeline: Lead to Scheduled");
    assert.ok(!at(message, message.from).thread && at(message, message.to).thread && at(message, message.to).reply, "Message: texted and answered");
    assert.ok(!at(review, review.from).toast && at(review, review.to).toast, "Review: one tap and its note");
    assert.match(src, /sceneView\(seg\.scene, t, \{ phone: true, sms: SAMPLE\.sms \}\)/);
    assert.match(src, /tradeSample\("hvac"\)/, "the homepage stays the HVAC shop");
    assert.match(src, /framed \/>/);
});
