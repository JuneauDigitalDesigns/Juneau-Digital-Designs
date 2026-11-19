/**
 * The portal tour, v3 (Xander, 19 Nov 2026): one walk through the whole portal, on a computer and
 * on a phone, moving from screen to screen by itself, with a hand-off card between sections and
 * nothing said twice.
 *
 * The steps are plain data (`app/components/portal/tour/steps.ts`), so the walk each tier and
 * device gets, and every word it says, are checked here directly. Anchors are checked at source
 * level: a step pointing at a `data-tour` or id that no component renders would show as a centred
 * card forever, and nothing else would notice.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
    TOUR_STEPS,
    HELP_MENU,
    WIN_JOBS,
    boldParts,
    hrefFor,
    sectionForPath,
    sectionWalk,
    walkFor,
    wordsFor,
} from "../app/components/portal/tour/steps.ts";

const tiers = ["starter", "growth"];
const devices = ["desktop", "mobile"];

function allTsx(dir) {
    const out = [];
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) out.push(...allTsx(p));
        else if (p.endsWith(".tsx")) out.push(p);
    }
    return out;
}
const SOURCE = [...allTsx("app/components/portal"), ...allTsx("app/portal")].map((p) => readFileSync(p, "utf8")).join("\n");

/** Is the anchor a step points at rendered by some component? */
function anchorExists(selector) {
    const tour = selector.match(/^\[data-tour="([^"]+)"\]$/);
    if (tour) {
        const name = tour[1];
        if (name.startsWith("nav-")) return /data-tour=\{`nav-\$\{tab\.id\}`\}/.test(SOURCE);
        if (name.startsWith("tab-") && name !== "tab-more") return /data-tour=\{`tab-\$\{tab\.id\}`\}/.test(SOURCE);
        if (name.startsWith("more-") && ["more-analytics", "more-settings", "more-support"].includes(name)) return /data-tour=\{`more-\$\{id\}`\}/.test(SOURCE);
        return SOURCE.includes(`data-tour="${name}"`) || SOURCE.includes(`dataTour="${name}"`) || SOURCE.includes(`"${name}" : undefined`);
    }
    if (/^\[data-row-id="[^"]+"\]$/.test(selector)) return SOURCE.includes("data-row-id={row.id}");
    const id = selector.match(/^#([\w-]+)$/);
    if (id) {
        const name = id[1];
        if (name.startsWith("crm-tabpanel-")) return SOURCE.includes("crm-tabpanel-");
        return SOURCE.includes(`id="${name}"`) || SOURCE.includes(`"${name}"`);
    }
    return false;
}

test("every step points at something a component renders, on both kinds of device", () => {
    for (const s of TOUR_STEPS) {
        for (const d of devices) {
            const view = s[d];
            if (view?.anchor) assert.ok(anchorExists(view.anchor), `${s.id} (${d}): ${view.anchor}`);
        }
    }
});

test("no step says anything with a dash in it", () => {
    for (const s of TOUR_STEPS) {
        for (const text of [s.title, s.body, s.phone?.title ?? "", s.phone?.body ?? ""]) {
            assert.doesNotMatch(text, /[–—]| - /, `${s.id}: ${text}`);
        }
    }
    for (const label of Object.values(HELP_MENU)) assert.doesNotMatch(label, /[–—]/);
});

test("nothing is said twice in one walk (Xander: 'Nothing should be said twice')", () => {
    for (const tier of tiers) {
        for (const d of devices) {
            const seen = new Map();
            for (const s of walkFor(tier, d)) {
                const { title, body } = wordsFor(s, d, tier);
                const key = body || title;
                assert.ok(!seen.has(key), `${tier}/${d}: "${s.id}" repeats "${seen.get(key)}"`);
                seen.set(key, s.id);
            }
        }
    }
});

test("the walk goes Home, Inbox, then the plan's own sections, then More, and ends on You're all set", () => {
    const order = ["Home", "Inbox", "Customers", "Calendar", "More"];
    for (const tier of tiers) {
        for (const d of devices) {
            const walk = walkFor(tier, d);
            const sections = walk.map((s) => s.section);
            for (let i = 1; i < sections.length; i++) {
                assert.ok(order.indexOf(sections[i]) >= order.indexOf(sections[i - 1]), `${tier}/${d}: ${walk[i].id} out of order`);
            }
            assert.equal(walk[0].id, "welcome");
            assert.equal(walk.at(-1).id, "all-set");
        }
    }
    assert.ok(!walkFor("starter", "mobile").some((s) => s.section === "Calendar"), "Starter has no Calendar section");
});

test("each section ends with a hand-off card pointing at the next tab, as Xander asked", () => {
    const handoffs = (tier, d) => walkFor(tier, d).filter((s) => s.handoff).map((s) => s.title);
    assert.deepEqual(handoffs("growth", "mobile"), [
        "Now let's take a look at your Inbox.",
        "Now let's look at what happens when your leads become customers.",
        "Now let's take a look at your Calendar.",
        "Now let's take a look at everything in More.",
    ]);
    // Starter: no "leads become customers" hand-off; "Want to go further?" stays on the Inbox.
    assert.deepEqual(handoffs("starter", "mobile"), ["Now let's take a look at your Inbox.", "Now let's take a look at everything in More."]);
    // There is no More on a computer, so no card says so there.
    assert.ok(!handoffs("growth", "desktop").some((t) => /More/.test(t)));
    for (const s of TOUR_STEPS.filter((x) => x.handoff)) assert.equal(s.body, "", `${s.id}: a hand-off card is its title alone`);
});

test("Starter's two 'Want to go further?' cards stay on the Inbox and outline Customers, then Calendar", () => {
    const further = walkFor("starter", "mobile").filter((s) => s.title === "Want to go further?");
    assert.equal(further.length, 2);
    assert.deepEqual(further.map((s) => s.mobile.at.path), ["/portal/calls", "/portal/calls"]);
    assert.deepEqual(further.map((s) => s.mobile.anchor), ['[data-tour="tab-customers"]', '[data-tour="tab-calendar"]']);
    assert.match(wordsFor(further[0], "mobile", "starter").body, /one-tap Google review requests\.$/);
    assert.match(wordsFor(further[0], "desktop", "starter").body, /one-click Google review requests\.$/);
});

test("Xander's own words are used exactly (19 Nov 2026)", () => {
    const byId = Object.fromEntries(TOUR_STEPS.map((s) => [s.id, s]));
    assert.equal(byId.welcome.body, "Thanks for coming on board with us. Here's a quick walkthrough on how your portal works.");
    assert.equal(wordsFor(byId.handle, "mobile", "growth").title, "Handle it in one swipe");
    assert.equal(wordsFor(byId.handle, "desktop", "growth").title, "Handle it in one tap");
    assert.deepEqual(
        boldParts(byId.find.body).filter((p) => p.bold).map((p) => p.text),
        ["Needs you", "All", "Calls", "Forms"],
        "the chip names are bold",
    );
    assert.equal(byId["review-message"].title, "Your Review message");
});

test("the lines kept from the v2 tours are word for word", () => {
    const words = TOUR_STEPS.flatMap((s) => [s.title, s.body, s.phone?.body ?? ""]).join("\n");
    for (const line of [
        "Every call your receptionist answers and every inquiry from your website lands here. Tap one to see who it was and what they wanted.",
        "Your receptionist writes up what they wanted. Play the recording to hear the whole call.",
        "After a happy job, one tap asks them for a Google review. More reviews bring more calls, so come back and do this often.",
        "Set a reminder, like “send the quote Friday”, and it flags when it's overdue. Booked visits show here too.",
        "Want something changed on your site, or something isn't right? Open a ticket here and we'll get back to you within one business day.",
        "That's it. Open the More menu anytime to tour the page you're on, or replay every tour.",
    ]) {
        assert.ok(words.includes(line), line);
    }
});

test("Growth's last card says Now go win some jobs; Starter's does not", () => {
    const last = TOUR_STEPS.find((s) => s.id === "all-set");
    assert.ok(wordsFor(last, "mobile", "growth").body.endsWith(WIN_JOBS));
    assert.ok(!wordsFor(last, "mobile", "starter").body.endsWith(WIN_JOBS));
});

test("Tour this page plays that page's section, without the hand-off that leads out of it", () => {
    assert.equal(sectionForPath("/portal"), "Home");
    assert.equal(sectionForPath("/portal/calls"), "Inbox");
    assert.equal(sectionForPath("/portal/settings/billing"), "More");
    assert.equal(sectionForPath("/portal/more/review"), "More");
    const inbox = sectionWalk("Inbox", "growth", "mobile");
    assert.ok(inbox.length > 2 && inbox.every((s) => s.section === "Inbox" && !s.handoff));
});

test("every screen the tour goes to carries the tour's sample switch and the site", () => {
    const href = hrefFor({ path: "/portal/customers", open: "record" }, "my-site");
    assert.match(href, /^\/portal\/customers\?/);
    assert.match(href, /site=my-site/);
    assert.match(href, /tour=1/);
    assert.match(href, /open=tour-/);
});
