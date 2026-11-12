/**
 * The portal's tours, v2 (Xander, 2026-11-12): a short welcome tour, then one tour per tab that
 * plays the first time the tab is opened, with no dimming.
 *
 * The tours are plain data (`app/components/portal/tour/tours.ts`), so what each tier sees, which
 * tour a page starts, and every word they say are checked here directly. Anchors are checked at
 * source level: a step pointing at a `data-tour` or id that no component renders would show as a
 * centred card forever, and nothing else would notice.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { buildTour, tourForPath, TOUR_IDS, ELEMENT_TOURS, HELP_MENU } from "../app/components/portal/tour/tours.ts";

const tiers = ["starter", "growth"];
const sizes = [false, true];

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
        return SOURCE.includes(`data-tour="${name}"`) || SOURCE.includes(`dataTour="${name}"`);
    }
    const id = selector.match(/^#([\w-]+)$/);
    if (id) {
        const name = id[1];
        if (name.startsWith("crm-tabpanel-")) return SOURCE.includes("crm-tabpanel-");
        return SOURCE.includes(`id="${name}"`) || SOURCE.includes(`"${name}"`);
    }
    return false;
}

test("every step of every tour points at something a component renders", () => {
    for (const tier of tiers) {
        for (const mobile of sizes) {
            for (const id of TOUR_IDS) {
                for (const step of buildTour(id, tier, mobile)) {
                    if (typeof step.element === "string") {
                        assert.ok(anchorExists(step.element), `${id} (${tier}${mobile ? ", phone" : ""}): ${step.element}`);
                    }
                }
            }
        }
    }
});

test("no tour says anything with a dash in it", () => {
    for (const tier of tiers) {
        for (const mobile of sizes) {
            for (const id of TOUR_IDS) {
                for (const s of buildTour(id, tier, mobile)) {
                    for (const text of [s.popover?.title ?? "", s.popover?.description ?? ""]) {
                        assert.doesNotMatch(text, /[–—]| - /, `${id}: ${text}`);
                    }
                }
            }
        }
    }
    for (const label of Object.values(HELP_MENU)) assert.doesNotMatch(label, /[–—]/);
});

test("each page starts its own tour, and the locked tabs start an honest one on Starter", () => {
    const cases = [
        ["/portal", "overview", "overview"],
        ["/portal/calls", "inbox", "inbox"],
        ["/portal/customers", "customers-locked", "customers"],
        ["/portal/calendar", "calendar-locked", "calendar"],
        ["/portal/analytics", "analytics", "analytics"],
        ["/portal/settings", "account", "account"],
        ["/portal/settings/billing", "billing", "billing"],
        ["/portal/support", "support", "support"],
    ];
    for (const [path, starter, growth] of cases) {
        assert.equal(tourForPath(path, "starter"), starter, path);
        assert.equal(tourForPath(path, "growth"), growth, path);
    }
    assert.equal(tourForPath("/portal/onboarding", "growth"), null);
    assert.equal(tourForPath("/portal/sign-in", "starter"), null);
});

test("the customer file and its tabs start their own tours when they appear, on Growth only", () => {
    assert.deepEqual(
        ELEMENT_TOURS.map((t) => t.id),
        ["customer", "contact", "jobs", "notes"],
    );
    for (const t of ELEMENT_TOURS) assert.equal(t.path, "/portal/customers");
});

const titles = (id, tier, mobile = false) => buildTour(id, tier, mobile).map((s) => s.popover.title);
const body = (id, tier, title, mobile = false) => buildTour(id, tier, mobile).find((s) => s.popover.title === title)?.popover.description;

test("the welcome tour walks down the tabs, per tier", () => {
    assert.deepEqual(titles("welcome", "starter"), [
        "👋 Welcome to your portal",
        "Your day at a glance",
        "Your inbox",
        "Want to go further?",
        "How your site is doing",
        "Your alerts and your plan",
        "Need a hand?",
        "You're all set",
    ]);
    assert.deepEqual(titles("welcome", "growth"), [
        "👋 Welcome to your portal",
        "Your day at a glance",
        "Your inbox",
        "Your customers",
        "Your calendar",
        "How your site is doing",
        "Your alerts and your plan",
        "Need a hand?",
        "You're all set",
    ]);
});

test("the lines Xander approved in the first draft are kept word for word", () => {
    assert.equal(
        body("inbox", "starter", "👋 This is your inbox"),
        "Every call your receptionist answers and every enquiry from your website lands here. Tap one to see who it was and what they wanted.",
    );
    assert.equal(
        body("inbox", "starter", "Find anything fast"),
        "Needs you shows what's still waiting on you. Switch to All, Calls or Forms, or search by name, number or what they said.",
    );
    assert.equal(body("inbox", "starter", "Handle it in one tap"), "Call them back, set a reminder for later, or mark it done once it's handled.");
    assert.equal(body("inbox", "starter", "Handle it in one tap", true), "Swipe right on a lead to call them back, or swipe left to mark it done.");
    assert.equal(body("inbox", "starter", "What they said"), "Your receptionist writes up what they wanted. Play the recording to hear the whole call.");
    assert.equal(
        body("inbox", "growth", "Keep the ones that matter"),
        "When an enquiry is a real job, promote them to a customer. Everything they've said is carried across automatically.",
    );
    assert.equal(
        body("welcome", "starter", "Want to go further?"),
        "Growth adds a file for every customer, a calendar for your jobs, texting from your business number, and Google review requests. Open Customers to see it in action.",
    );
    assert.equal(body("customer", "growth", "⭐ Here's the magic"), "After a happy job, one tap asks them for a Google review. More reviews bring more calls, so come back and do this often.");
    assert.equal(
        body("customer", "growth", "Never forget a follow-up"),
        "Set a reminder, like “send the quote Friday”, and it flags when it's overdue. Booked visits show here too.",
    );
    assert.equal(body("welcome", "growth", "Your calendar"), "Job visits, estimates and call backs in one month view, each tied to its customer.");
});

test("the inbox tour points at the open lead on a computer, and skips the write-up on a phone", () => {
    assert.deepEqual(titles("inbox", "starter"), ["👋 This is your inbox", "Find anything fast", "Handle it in one tap", "What they said"]);
    assert.deepEqual(titles("inbox", "starter", true), ["👋 This is your inbox", "Find anything fast", "Handle it in one tap"]);
    assert.deepEqual(titles("inbox", "growth"), ["👋 This is your inbox", "Find anything fast", "Handle it in one tap", "What they said", "Keep the ones that matter"]);
});

test("Help offers this page's tour or every tour again", () => {
    assert.deepEqual(HELP_MENU, { page: "Tour this page", all: "Replay all tours" });
});

import { nextSeen, TAB_TOURS } from "../app/lib/portal-tour-seen.ts";

test("every tab tour can be remembered, and nothing else can", () => {
    assert.deepEqual([...TAB_TOURS].sort(), TOUR_IDS.filter((id) => id !== "welcome").sort());
    assert.deepEqual(nextSeen(["inbox"], "welcome", false), ["inbox"]);
    assert.deepEqual(nextSeen(["inbox", "<script>", 4], undefined, false), ["inbox"]);
});

test("a tab tour is remembered once, and Replay all tours forgets them all", () => {
    assert.deepEqual(nextSeen(["inbox"], "overview", false), ["inbox", "overview"]);
    assert.deepEqual(nextSeen(["inbox", "overview"], "inbox", false), ["inbox", "overview"]);
    assert.deepEqual(nextSeen(["inbox", "overview"], undefined, true), []);
});

test("the tour route keeps the welcome tour one way, and stores the seen list through nextSeen", () => {
    const route = readFileSync("app/api/portal/tour/route.ts", "utf8");
    assert.match(route, /completed:\s*body\.completed === true \|\| prev\.completed === true/);
    assert.match(route, /seen:\s*nextSeen\(prev\.seen, body\.seen, body\.resetSeen === true\)/);
});
