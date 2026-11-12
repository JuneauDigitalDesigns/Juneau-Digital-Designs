/**
 * The Starter → Growth demo (`app/components/portal/growth-demo/`), rebuilt 2026-11-12.
 *
 * Xander asked for it to slow down a little, for a cursor that shows what it is clicking, for
 * reworked words on every step, and for it to show the portal exactly as it now is. So: five
 * scenes, a cursor driven by the demo's own clock, and the portal's real components fed sample
 * data. The timing, the cursor and the words are pure (`script.ts`) and imported for real through
 * the transpile hooks `npm test` registers; the rules about which components it draws, and that
 * the real record never fetches in the demo, are checked at source level, because there is no
 * browser in this suite and no test account to sign in with.
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
import { CARRIER_LINE } from "../app/data/portal-demo.ts";

const DIR = "app/components/portal/growth-demo";
const read = (p) => readFileSync(p, "utf8");

/* ── the sequence ─────────────────────────────────────────────────────── */

test("intro, then a title card before each of the five scenes, then the end card", () => {
    assert.equal(SCENE_COUNT, 5);
    assert.deepEqual([...SEGMENTS], ["intro", "scrim1", "s1", "scrim2", "s2", "scrim3", "s3", "scrim4", "s4", "scrim5", "s5", "end"]);
    assert.deepEqual(SEGMENTS.map(sceneOf), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, null]);
    assert.deepEqual(SEGMENTS.map(stepOf), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
});

test("it runs about a minute and a half, a little slower than before, as the intro says", () => {
    assert.ok(TOTAL_MS >= 85_000 && TOTAL_MS <= 100_000, `total is ${TOTAL_MS}ms`);
    assert.match(COPY.scrims.intro.sub, /About a minute and a half\.$/);
    for (const n of [1, 2, 3, 4, 5]) assert.ok(DURATION[`s${n}`] >= 14_000, `scene ${n} holds at least 14s`);
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

/* ── what each scene does ─────────────────────────────────────────────── */

test("scene 1: the lead opens, is promoted, and stays open on Promoted", () => {
    assert.equal(sceneView(1, 0).leadOpen, false);
    assert.equal(sceneView(1, BEATS.s1.open).leadOpen, true);
    assert.equal(sceneView(1, BEATS.s1.promoting).promoting, true);
    const done = sceneView(1, BEATS.s1.promoted);
    assert.deepEqual([done.leadOpen, done.promoting, done.promoted], [true, false, true]);
});

test("scene 2: Dave is lifted and moves Lead → Contacted → Quoted → Scheduled, then is dropped", () => {
    const stages = [];
    for (let ms = 0; ms < DURATION.s2; ms += 100) {
        const d = sceneView(2, ms).daveStage;
        if (stages[stages.length - 1] !== d) stages.push(d);
    }
    assert.deepEqual(stages, [0, 1, 2, 3]);
    assert.equal(sceneView(2, BEATS.s2.lift).lifted, true);
    assert.equal(sceneView(2, BEATS.s2.drop).lifted, false);
});

test("scene 3: the file opens, goes to Jobs, the job is added, then the calendar shows the visit", () => {
    assert.equal(sceneView(3, 0).view, "none");
    assert.equal(sceneView(3, BEATS.s3.record).view, "record");
    assert.equal(sceneView(3, BEATS.s3.record).tab, "timeline");
    assert.equal(sceneView(3, BEATS.s3.jobsTab).tab, "jobs");
    assert.equal(sceneView(3, BEATS.s3.jobsTab).job, false);
    assert.equal(sceneView(3, BEATS.s3.job).job, true);
    assert.equal(sceneView(3, BEATS.s3.calendar).view, "calendar");
});

test("scene 4: the text box is clicked into, the text types out and sends, and Dave replies", () => {
    assert.equal(sceneView(4, BEATS.s4.focus).composing, true);
    const mid = sceneView(4, BEATS.s4.typeFrom + 1000);
    assert.ok(mid.typed.length > 0 && COPY.sms.startsWith(mid.typed));
    const sent = sceneView(4, BEATS.s4.sent);
    assert.deepEqual([sent.sent, sent.typed, sent.composing], [true, "", false]);
    assert.equal(sceneView(4, BEATS.s4.reply).reply, true);
    assert.ok(BEATS.s4.typeFrom + (COPY.sms.length / BEATS.s4.charsPerSec) * 1000 < BEATS.s4.sent, "the whole text types before it sends");
});

test("scene 5: Won, the review window opens, the message is clicked into, then it sends", () => {
    assert.equal(sceneView(5, BEATS.s5.won).won, true);
    assert.equal(sceneView(5, BEATS.s5.open).reviewOpen, true);
    assert.equal(sceneView(5, BEATS.s5.editing).editing, true);
    const sent = sceneView(5, BEATS.s5.sent);
    assert.deepEqual([sent.reviewSent, sent.reviewOpen, sent.editing], [true, false, false]);
});

test("reduced motion draws every scene as its finished frame, with no cursor", () => {
    const v = [1, 2, 3, 4, 5].map((n) => sceneView(n, 0, true));
    assert.equal(v[0].promoted, true);
    assert.equal(v[1].daveStage, 3);
    assert.equal(v[2].view, "calendar");
    assert.deepEqual([v[3].sent, v[3].reply, v[3].typed], [true, true, ""]);
    // Scene 5's caption is about the review window, so it stays open on its message.
    assert.deepEqual([v[4].won, v[4].reviewOpen], [true, true]);
    for (const n of [1, 2, 3, 4, 5]) assert.equal(cursorAt(n, 5000, true).to, null);
});

/* ── the cursor ───────────────────────────────────────────────────────── */

test("the cursor clicks just before each thing it causes happens", () => {
    const clickAt = (n, sel) => CURSOR[n].find((s) => s.click && s.to === sel).at;
    assert.ok(clickAt(1, '[data-tour="inbox-promote"]') <= BEATS.s1.promoting);
    assert.ok(clickAt(3, "#crm-tab-jobs") <= BEATS.s3.jobsTab);
    assert.ok(clickAt(3, '[data-tour="crm-jobs-add"]') <= BEATS.s3.job);
    assert.ok(clickAt(3, '[data-tour="crm-job-calendar"]') <= BEATS.s3.calendar);
    assert.ok(clickAt(4, '[data-demo="send"]') <= BEATS.s4.sent);
    assert.ok(clickAt(5, '[data-tour="crm-drawer-review"]') <= BEATS.s5.open);
    assert.ok(clickAt(5, '[data-demo="review-send"]') <= BEATS.s5.sent);
});

test("the cursor glides between stops, holds while dragging, and counts its clicks", () => {
    const first = CURSOR[1][0];
    assert.equal(cursorAt(1, first.at - 1).to, null, "nothing before the first stop");
    const moving = cursorAt(1, CURSOR[1][2].at + CURSOR_MOVE_MS / 2);
    assert.ok(moving.p > 0 && moving.p < 1);
    assert.equal(cursorAt(1, CURSOR[1][2].at + CURSOR_MOVE_MS).p, 1);
    assert.equal(cursorAt(2, BEATS.s2.moves[0] + 100).down, true);
    assert.equal(cursorAt(1, 9000).clicks, 2);
    for (const n of [1, 2, 3, 4, 5]) {
        const at = CURSOR[n].map((s) => s.at);
        assert.deepEqual(at, [...at].sort((a, b) => a - b), `scene ${n}'s stops are in order`);
        assert.ok(at[at.length - 1] < DURATION[`s${n}`], `scene ${n}'s cursor leaves before it ends`);
    }
});

/* ── the words ────────────────────────────────────────────────────────── */

test("the step cards and captions are the approved wording, with no dashes", () => {
    assert.deepEqual(
        [1, 2, 3, 4, 5].map((n) => COPY.scrims[`scrim${n}`].title),
        ["Turn a caller into a customer", "Work the job", "Book the visit", "Text them from your business number", "Ask for the review"],
    );
    assert.equal(captionFor(3).text, "Open Dave's file and add the job: the service, its status and what it's worth. Add to calendar books the visit.");
    assert.equal(
        captionFor(5).text,
        "When the job is done, ask for a Google review. The message is already written, and you can change it before it goes.",
    );
    assert.deepEqual([1, 2, 3, 4, 5].map((n) => captionFor(n).gate), [null, null, null, CARRIER_LINE, CARRIER_LINE]);
    const all = JSON.stringify(COPY);
    assert.doesNotMatch(all, /[–—]/);
    assert.doesNotMatch(all, /Brannock/, "the sample text names the demo's own business");
});

test("every part but the end card is announced", () => {
    for (const seg of SEGMENTS) {
        if (seg === "end") assert.equal(announcementFor(seg), "");
        else assert.ok(announcementFor(seg).length > 10, seg);
    }
    assert.match(announcementFor("scrim2"), /^STEP 2 OF 5\. Work the job\./);
    assert.ok(announcementFor("s4").endsWith(CARRIER_LINE));
});

/* ── source-level rules ───────────────────────────────────────────────── */

test("the replica draws the portal's own components, not copies of them", () => {
    const desk = read(`${DIR}/DesktopReplica.tsx`);
    for (const c of ["InboxList", "LeadDetail", "InboxToolbar", "Column", "CustomerPanel", "CustomerRecord", "MonthGrid", "DayList"]) {
        assert.match(desk, new RegExp(`<${c}\\b`), c);
    }
    const phone = read(`${DIR}/PhoneReplica.tsx`);
    for (const c of ["InboxList", "LeadDetail", "MobileCard", "CustomerRecord", "MiniMonth", "DayList"]) {
        assert.match(phone, new RegExp(`<${c}\\b`), c);
    }
});

test("in the demo the real customer record fetches nothing and saves nothing", () => {
    const rec = read("app/components/portal/crm/CustomerRecord.tsx");
    assert.match(rec, /const data = demo \? demo\.data : fetched;/);
    assert.match(rec, /if \(!customerId \|\| isDemo\) return;/);
    assert.match(rec, /if \(!customerId \|\| demo\) return false;/);
    assert.match(rec, /if \(!customerId \|\| demo \|\| !draft\.trim\(\)\) return;/);
    assert.match(rec, /customer\.phone && !demo &&/, "no quick-replies fetch in the demo");
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

test("Upgrade goes where the old walkthrough went, and ?demo=growth opens it once", () => {
    const src = read("app/components/portal/crm/StarterShowcase.tsx");
    assert.match(src, /<GrowthDemo upgradeUrl=\{upgradeHref\(site\.slug\)\}/);
    assert.match(src, /DEMO_PARAM = "demo"/);
    assert.match(src, /DEMO_GROWTH = "growth"/);
    assert.match(src, /searchParams\.delete\(DEMO_PARAM\)/, "the parameter is dropped after opening");
    assert.match(src, /A short demo with sample customers\. Nothing changes on your account\./);
});

test("the driver.js walkthrough is gone, and the first-run tour keeps its theme", () => {
    assert.equal(existsSync("app/components/portal/tour/showcase.ts"), false);
    assert.doesNotMatch(read("app/components/portal/crm/StarterShowcase.tsx"), /runGrowthShowcase|tour\/showcase/);
    assert.match(read("app/components/portal/tour/TourController.tsx"), /import "\.\/tour-theme\.css";/);
});
