/**
 * The client's page-addition notice (Xander, 2026-11-14: mockups and W60–W130 approved word for
 * word, https://claude.ai/artifact/LsqdNvjduNNY4YABQjPdhu). Pure: a proposal record, the site's
 * search profile and the client's facts in; the notice to show (or none) out.
 *
 * The timing rules are his: in review until JDD decides; waiting for facts never expires while
 * unanswered; the thank-you goes 7 days after it appears or at live; paused goes 7 days after it
 * appears; live, not for now, not going ahead and page merged go 7 days after the client FIRST
 * SEES them, so a client who never signs in never misses one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { stageOf, noticeFor, factsNeeded, PA } = await import("../app/lib/page-additions.ts");

const DAY = 86_400_000;
const NOW = new Date("2026-11-20T12:00:00Z");
const ago = (d) => new Date(NOW.getTime() - d * DAY).toISOString();

const profile = {
    v: 1, siteSlug: "acme", property: "https://acme.vercel.app/", verifiedAt: ago(30), mainCity: "Clermont",
    caps: { area: 10, spoke: 15 }, updatedAt: ago(10),
    towns: [
        { name: "Minneola", slug: "minneola", hub: true, qualifies: true, facts: 4 },
        { name: "Groveland", slug: "groveland", hub: false, qualifies: false, facts: 1, kinds: ["job"] },
    ],
    services: [{ slug: "ac-repair", name: "AC Repair", terms: ["ac repair"], page: true }],
    sharedFacts: { "Minneola|ac-repair": 0 },
    spokes: [],
};
const spoke = (over = {}) => ({
    id: "spoke:minneola:ac-repair", kind: "ask-client", town: "Minneola", service: "ac-repair", status: "open",
    createdAt: ago(5), evidence: { windowDays: 90, impressions: 32, clicks: 1, queries: [{ query: "q", impressions: 32, clicks: 1, position: 9 }] }, ...over,
});
const facts = (over = {}) => ({ v: 1, proposalId: "spoke:minneola:ac-repair", siteSlug: "acme", town: "Minneola", service: "ac-repair", updatedAt: ago(1), submittedAt: null, photos: [], reviews: [], jobs: [], ...over });
const photo = (over = {}) => ({ id: `p${Math.random()}`, url: "https://x.public.blob.vercel-storage.com/a.jpg", filename: "a.jpg", alt: "", town: "Minneola", service: "ac-repair", addedAt: ago(1), status: "pending", ...over });
const review = (over = {}) => ({ id: `r${Math.random()}`, text: "Great", name: null, town: "Minneola", service: "ac-repair", verbatim: true, addedAt: ago(1), status: "pending", ...over });

test("stage comes from the record, or from the status the console wrote before stages existed", () => {
    assert.equal(stageOf(spoke()), "review");
    assert.equal(stageOf(spoke({ status: "declined" })), "not-now");
    assert.equal(stageOf(spoke({ status: "asked" })), "waiting");
    assert.equal(stageOf(spoke({ status: "approved", kind: "spoke" })), "building");
    assert.equal(stageOf(spoke({ status: "approved", kind: "fold", id: "fold:minneola:ac-repair" })), "merged");
    assert.equal(stageOf(spoke({ status: "asked", stage: "paused" })), "paused");
});

test("in review: a page (W60–W63, counts only) or a town page (W64–W65); a merge-back proposal shows nothing", () => {
    const n = noticeFor({ proposal: spoke(), profile, facts: null, now: NOW });
    assert.equal(n.chip, "In review");
    assert.equal(n.heading, "A new page for AC Repair in Minneola");
    assert.equal(n.body, "People in Minneola are finding your site when they search for AC Repair. We're reviewing whether a page for it would help, and we'll let you know soon.");
    assert.equal(n.count, "Your site showed up in these searches 32 times in the last 90 days.");
    assert.ok(!JSON.stringify(n).includes('"q"'), "never a search itself");
    const t = noticeFor({ proposal: spoke({ id: "town:groveland", kind: "town-facts", town: "Groveland", service: undefined }), profile, facts: null, now: NOW });
    assert.equal(t.heading, "A page for Groveland");
    assert.equal(t.body, "People in Groveland are finding your site. We're reviewing whether a page for the town would help, and we'll let you know soon.");
    assert.equal(noticeFor({ proposal: spoke({ id: "fold:minneola:ac-repair", kind: "fold" }), profile, facts: null, now: NOW }), null);
    assert.equal(noticeFor({ proposal: spoke({ evidence: { ...spoke().evidence, impressions: 1 } }), profile, facts: null, now: NOW }).count,
        "Your site showed up in these searches 1 time in the last 90 days.");
});

test("waiting for facts never expires while unanswered, and counts what is still needed (W66–W70)", () => {
    const n = noticeFor({ proposal: spoke({ status: "asked", stageAt: ago(200) }), profile, facts: null, now: NOW });
    assert.equal(n.chip, "We need your help");
    assert.equal(n.heading, "Help us build your AC Repair in Minneola page");
    assert.equal(n.body, "We'd like to add this page. It needs photos and reviews from real jobs in Minneola. Nothing goes on your site until we've checked it.");
    assert.equal(n.needed, "2 more needed");
    assert.equal(n.action, "Add photos and reviews");
    assert.equal(n.opensWizard, true);
    const town = noticeFor({ proposal: spoke({ id: "town:groveland", kind: "town-facts", town: "Groveland", service: undefined, status: "asked" }), profile, facts: null, now: NOW });
    assert.equal(town.heading, "Help us build your Groveland page");
});

test("facts needed: shared facts for the page, plus the town page's 3 facts of 2 kinds", () => {
    assert.equal(factsNeeded({ proposal: spoke(), profile, facts: facts({ photos: [photo()] }) }), 1);
    assert.equal(factsNeeded({ proposal: spoke(), profile, facts: facts({ photos: [photo()], reviews: [review()] }) }), 0);
    // A rejected item counts for nothing; an accepted one counts until the next export folds it into the profile.
    assert.equal(factsNeeded({ proposal: spoke(), profile, facts: facts({ photos: [photo({ status: "rejected" }), photo({ status: "accepted", decidedAt: ago(1) })] }) }), 1);
    assert.equal(factsNeeded({ proposal: spoke(), profile, facts: facts({ photos: [photo({ status: "accepted", decidedAt: ago(20) })] }) }), 2, "already in the exported profile");
    const groveland = spoke({ id: "town:groveland", kind: "town-facts", town: "Groveland", service: undefined });
    // 1 job photo already; needs 3 facts of 2 kinds: two more photos still leave one kind.
    assert.equal(factsNeeded({ proposal: groveland, profile, facts: facts({ town: "Groveland", service: null, photos: [photo({ town: "Groveland", service: null }), photo({ town: "Groveland", service: null })] }) }), 1);
    assert.equal(factsNeeded({ proposal: groveland, profile, facts: facts({ town: "Groveland", service: null, photos: [photo({ town: "Groveland", service: null })], reviews: [review({ town: "Groveland", service: null })] }) }), 0);
    // A photo for another town does not count here.
    assert.equal(factsNeeded({ proposal: spoke(), profile, facts: facts({ photos: [photo({ town: "Groveland" })] }) }), 2);
});

test("a fact JDD rejected sends the notice back to waiting with W92", () => {
    const f = facts({ submittedAt: ago(2), photos: [photo({ status: "rejected", decidedAt: ago(1) }), photo()] });
    const n = noticeFor({ proposal: spoke({ status: "asked", stage: "received", stageAt: ago(2) }), profile, facts: f, now: NOW });
    assert.equal(n.chip, "We need your help");
    assert.equal(n.body, "We couldn't use 1 of the photos or reviews you sent, so we still need 1 more.");
});

test("thank you (W71–W73) goes 7 days after it appears", () => {
    const f = facts({ submittedAt: ago(1), photos: [photo()], reviews: [review()] });
    const n = noticeFor({ proposal: spoke({ status: "asked", stage: "received", stageAt: ago(1) }), profile, facts: f, now: NOW });
    assert.deepEqual([n.chip, n.heading, n.body], ["Thank you", "We have what we need for AC Repair in Minneola",
        "Thanks. We have all the information we need for this page and will follow up if we need anything else."]);
    assert.equal(noticeFor({ proposal: spoke({ status: "asked", stage: "received", stageAt: ago(8) }), profile, facts: f, now: NOW }), null);
});

test("live, not for now, not going ahead and merged go 7 days after FIRST SEEN; unseen, they stay", () => {
    for (const [over, chip] of [
        [{ status: "approved", kind: "spoke", stage: "live" }, "Live"],
        [{ status: "declined" }, "Not for now"],
        [{ status: "asked", stage: "cancelled" }, "Not going ahead"],
        [{ status: "approved", kind: "fold", id: "fold:minneola:ac-repair", stage: "merged" }, "Page merged"],
    ]) {
        const stage = over.stage ?? stageOf(spoke(over));
        const base = spoke({ ...over, stageAt: ago(60), decidedAt: ago(60) });
        assert.equal(noticeFor({ proposal: base, profile, facts: null, now: NOW }).chip, chip, `${chip}: unseen after 60 days, still shown`);
        assert.ok(noticeFor({ proposal: { ...base, seen: { stage, at: ago(6) } }, profile, facts: null, now: NOW }), `${chip}: 6 days after seen`);
        assert.equal(noticeFor({ proposal: { ...base, seen: { stage, at: ago(8) } }, profile, facts: null, now: NOW }), null, `${chip}: 8 days after seen`);
        assert.ok(noticeFor({ proposal: { ...base, seen: { stage: "review", at: ago(30) } }, profile, facts: null, now: NOW }), `${chip}: seen in an earlier stage does not count`);
    }
});

test("the live notice links the page; paused goes 7 days after it appears", () => {
    const live = noticeFor({ proposal: spoke({ status: "approved", kind: "spoke", stage: "live", liveUrl: "https://acme.vercel.app/areas/minneola/ac-repair" }), profile, facts: null, now: NOW });
    assert.deepEqual([live.heading, live.action, live.href], ["Your AC Repair in Minneola page is live", "View the page", "https://acme.vercel.app/areas/minneola/ac-repair"]);
    const paused = spoke({ status: "asked", stage: "paused", stageAt: ago(3) });
    assert.deepEqual(Object.values(noticeFor({ proposal: paused, profile, facts: null, now: NOW })).slice(0, 3), ["Paused", "We've paused AC Repair in Minneola",
        "Got it. We won't add this page, and we may be in touch about it. Anything you already sent stays with us."]);
    assert.equal(noticeFor({ proposal: { ...paused, stageAt: ago(8) }, profile, facts: null, now: NOW }), null);
});

test("the wizard's own strings (W93–W112) are the approved ones", () => {
    assert.equal(PA.wizardTitle("AC Repair", "Minneola"), "AC Repair in Minneola");
    assert.equal(PA.wizardTitle(null, "Groveland"), "Groveland");
    assert.equal(PA.rule("AC Repair", "Minneola"), "This page needs at least 2 photos or reviews from AC Repair jobs in Minneola, and your Minneola page needs 3 facts of at least 2 kinds.");
    assert.equal(PA.rule(null, "Groveland"), "Your Groveland page needs 3 photos or reviews from jobs in Groveland, of at least 2 kinds.");
    assert.deepEqual([PA.photosTitle("Minneola"), PA.photosHelp("AC Repair", "Minneola"), PA.addPhotos], ["Photos from jobs in Minneola", "Photos of AC Repair work you did in Minneola.", "Add photos"]);
    assert.deepEqual([PA.reviewsTitle("Minneola"), PA.review, PA.firstName, PA.optional, PA.addReview], ["Reviews from customers in Minneola", "Review", "Customer's first name", "Optional.", "Add another review"]);
    assert.equal(PA.verbatimTick, "Copied word for word from the review. Not edited, not combined.");
    assert.deepEqual([PA.photoTownQ, PA.photoTownHelp], ["Which town was this job in?", "Town only, never the street."]);
    assert.deepEqual([PA.jobTitle("Minneola"), PA.jobHelp], ["A job you did in Minneola", "Optional. In your own words, for example what the problem was and how you fixed it. Never a customer's address."]);
    assert.deepEqual([PA.send, PA.saveLater, PA.saved, PA.sendNote(2)], ["Send to Juneau Digital Designs", "Save and finish later", "Saved", "You can send what you have now. The page needs 2 more before we can build it."]);
    assert.deepEqual([PA.declineTitle, PA.declineBody, PA.declineReason, PA.declineButton], ["Don't want this page?", "We'll pause it and won't add it. Anything you've sent stays with us.", "Anything you'd like us to know?", "I don't want this page"]);
    assert.deepEqual([PA.alertSubject, PA.alertBody], ["Search Console nightly job needs attention",
        "The nightly Search Console job failed or read nothing for any site on its last 2 runs. The usual cause is a revoked Google sign-in. Run npm run google-sign-in in jdd-ops, then update GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN on the agency's Vercel project."]);
});

test("the portal screens show only the approved strings: no text of their own", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["../app/components/portal/page-additions/PageAdditionWizard.tsx", "../app/components/portal/page-additions/PageAdditionNotices.tsx"]) {
        const src = readFileSync(new URL(f, import.meta.url), "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
        const text = [...src.matchAll(/>\s*([A-Za-z][^<>{}]*?)\s*</g)].map((m) => m[1].trim()).filter(Boolean);
        assert.deepEqual(text, [], `${f} has literal text: ${text.join(" | ")}`);
        assert.match(src, /PA\.|siteNotices/);
    }
    const wizard = readFileSync(new URL("../app/components/portal/page-additions/PageAdditionWizard.tsx", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
    // The only literal message: onboarding's own upload error, reused as approved there.
    const quoted = [...wizard.matchAll(/"([A-Z][^"]{12,})"/g)].map((m) => m[1]);
    assert.deepEqual(quoted, ["Upload failed. Please try again."]);
});
