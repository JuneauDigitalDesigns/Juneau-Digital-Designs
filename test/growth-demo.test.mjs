/**
 * The Starter → Growth demo (`app/components/portal/growth-demo/`).
 *
 * The timing and scene rules are pure (`script.ts`) and imported for real through the transpile
 * hooks `npm test` registers. The UI rules that matter most — a real modal, the upgrade link
 * the old walkthrough used, the `?demo=growth` contract the Overview links to — are checked at
 * source level, because there is no browser in this suite and no test account to sign in with.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
    BEATS,
    COPY,
    DURATION,
    SEGMENTS,
    TOTAL_MS,
    announcementFor,
    captionFor,
    sceneOf,
    sceneView,
    stepOf,
    tick,
} from "../app/components/portal/growth-demo/script.ts";
import { CARRIER_LINE, DEMO_STEPS } from "../app/data/portal-demo.ts";

const DIR = "app/components/portal/growth-demo";
const read = (p) => readFileSync(p, "utf8");

/* ── the sequence ─────────────────────────────────────────────────────── */

test("intro, then a title card before each of the four scenes, then the end card", () => {
    assert.deepEqual([...SEGMENTS], ["intro", "scrim1", "s1", "scrim2", "s2", "scrim3", "s3", "scrim4", "s4", "end"]);
    assert.deepEqual(SEGMENTS.map(sceneOf), [1, 1, 1, 2, 2, 3, 3, 4, 4, null]);
    assert.deepEqual(SEGMENTS.map(stepOf), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
});

test("it runs about a minute, as the Customers page promises", () => {
    // "A one-minute demo with sample customers." and the intro's "About a minute."
    assert.ok(TOTAL_MS >= 55_000 && TOTAL_MS <= 65_000, `total is ${TOTAL_MS}ms`);
    assert.match(COPY.scrims.intro.sub, /About a minute\.$/);
});

test("the clock advances one part at a time and stops on the end card", () => {
    let at = { i: 0, t: 0 };
    let steps = 0;
    const seen = [0];
    while (SEGMENTS[at.i] !== "end" && steps < 10_000) {
        at = tick(at.i, at.t, 100);
        if (seen[seen.length - 1] !== at.i) seen.push(at.i);
        steps++;
    }
    assert.deepEqual(seen, SEGMENTS.map((_, i) => i), "visits every part in order");
    assert.equal(steps, Math.ceil(TOTAL_MS / 100), "at real speed it takes the full duration");
    assert.deepEqual(tick(at.i, 0, 60_000), at, "the end card waits for the client");
});

test("a long stall lands on the next part rather than skipping a scene", () => {
    const s1 = SEGMENTS.indexOf("s1");
    assert.deepEqual(tick(s1, 0, 10 * 60_000), { i: s1 + 1, t: 0 });
});

/* ── the scenes ───────────────────────────────────────────────────────── */

test("scene 1: the lead opens, then is promoted", () => {
    assert.equal(sceneView(1, 0).drawer, false);
    assert.equal(sceneView(1, BEATS.s1.drawer).drawer, true);
    assert.equal(sceneView(1, BEATS.s1.drawer).promoted, false);
    assert.equal(sceneView(1, BEATS.s1.promoted).promoted, true);
    assert.ok(BEATS.s1.promoted < DURATION.s1);
});

test("scene 2: Dave moves Lead → Contacted → Quoted → Scheduled, in order, and stays", () => {
    const stages = [];
    for (let ms = 0; ms < DURATION.s2; ms += 100) {
        const d = sceneView(2, ms).daveStage;
        if (stages[stages.length - 1] !== d) stages.push(d);
    }
    assert.deepEqual(stages, [0, 1, 2, 3]);
});

test("scene 3: the text types out, sends from the composer, and Dave replies", () => {
    const mid = sceneView(3, BEATS.s3.typeFrom + 1000);
    assert.ok(mid.typed.length > 0 && COPY.sms.startsWith(mid.typed));
    assert.equal(sceneView(3, BEATS.s3.sent - 1).typed, COPY.sms, "fully typed before it sends");
    const sent = sceneView(3, BEATS.s3.sent);
    assert.equal(sent.sent, true);
    assert.equal(sent.typed, "", "the composer clears once sent");
    assert.equal(sceneView(3, BEATS.s3.reply).reply, true);
});

test("scene 4: the job is won and the pre-written request goes out", () => {
    const open = sceneView(4, BEATS.s4.dialog);
    assert.equal(open.won, true);
    assert.equal(open.dialog, true);
    assert.equal(open.reviewSent, false);
    assert.equal(sceneView(4, BEATS.s4.armed).armed, true);
    const sent = sceneView(4, BEATS.s4.sent);
    assert.equal(sent.reviewSent, true);
    assert.equal(sent.armed, false);
    assert.equal(sceneView(4, BEATS.s4.dialogClose).dialog, false);
});

test("reduced motion draws every scene as its finished frame from the first moment", () => {
    assert.deepEqual(
        [1, 2, 3, 4].map((n) => {
            const v = sceneView(n, 0, true);
            return [v.caption, v.drawer, v.promoted, v.daveStage, v.sent, v.reply, v.typed, v.reviewSent, v.armed];
        }),
        [
            [true, true, true, 0, false, false, "", false, false],
            [true, false, false, 3, false, false, "", false, false],
            [true, false, false, 3, true, true, "", false, false],
            [true, false, false, 3, true, true, "", true, false],
        ],
    );
    // Scene 4's caption is about the request itself, so its dialog stays up, on "Review requested".
    assert.equal(sceneView(4, 0, true).dialog, true);
});

/* ── the words ────────────────────────────────────────────────────────── */

test("the captions are the homepage demo's approved ones, carrier line on texting and reviews", () => {
    const by = Object.fromEntries(DEMO_STEPS.map((d) => [d.key, d]));
    assert.equal(captionFor(1).text, by.promote.caption);
    assert.equal(captionFor(2).text, by.pipeline.caption);
    assert.equal(captionFor(3).text, by.message.caption);
    assert.equal(captionFor(4).text, by.review.caption);
    assert.deepEqual([1, 2, 3, 4].map((n) => captionFor(n).gate), [null, null, CARRIER_LINE, CARRIER_LINE]);
});

test("every part but the end card is announced", () => {
    for (const seg of SEGMENTS) {
        if (seg === "end") assert.equal(announcementFor(seg), "");
        else assert.ok(announcementFor(seg).length > 10, seg);
    }
    assert.match(announcementFor("scrim2"), /^STEP 2 OF 4\. Work the job\./);
    assert.ok(announcementFor("s3").endsWith(CARRIER_LINE));
});

/* ── source-level rules ───────────────────────────────────────────────── */

test("the takeover is a real modal inside a real .portal-scope", () => {
    const src = read(`${DIR}/GrowthDemo.tsx`);
    assert.match(src, /role="dialog"/);
    assert.match(src, /aria-modal="true"/);
    assert.match(src, /aria-live="polite"/);
    assert.match(src, /className=\{`portal-scope /, "the replica must read the portal's tokens");
    assert.match(src, /createPortal\(/);
    assert.match(src, /"Escape"/);
    assert.match(src, /overflow = "hidden"/, "the page behind does not scroll");
});

test("the replica is decorative; the live region is the narration", () => {
    const src = read(`${DIR}/GrowthDemo.tsx`);
    assert.match(src, /className=\{s\.screen\} data-dim=\{scrim\} aria-hidden="true"/);
    assert.match(src, /className=\{s\.sizer\}[^>]*aria-hidden="true"/);
});

test("Upgrade goes where the old walkthrough went, and ?demo=growth opens it once", () => {
    const src = read("app/components/portal/crm/StarterShowcase.tsx");
    assert.match(src, /<GrowthDemo upgradeUrl=\{upgradeHref\(site\.slug\)\}/);
    assert.match(src, /DEMO_PARAM = "demo"/);
    assert.match(src, /DEMO_GROWTH = "growth"/);
    assert.match(src, /searchParams\.delete\(DEMO_PARAM\)/, "the parameter is dropped after opening");
    assert.match(src, /A one-minute demo with sample customers\. Nothing changes on your account\./);
});

test("the driver.js walkthrough is gone, and the first-run tour keeps its theme", () => {
    assert.equal(existsSync("app/components/portal/tour/showcase.ts"), false);
    assert.doesNotMatch(read("app/components/portal/crm/StarterShowcase.tsx"), /runGrowthShowcase|tour\/showcase/);
    assert.match(read("app/components/portal/tour/TourController.tsx"), /import "\.\/tour-theme\.css";/);
});
