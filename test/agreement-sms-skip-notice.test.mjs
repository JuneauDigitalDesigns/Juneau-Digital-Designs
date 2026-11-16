/**
 * "Continue without text alerts?": two presses of Agree when the optional text-alerts box is left
 * unticked, on both agreement pages.
 *
 * Xander, 2026-11-15: clients can buy a plan and not use the texts, but then they only learn of a
 * lead when they next check the portal, and the system is built around answering within minutes
 * of a text. So the first unticked press shows a notice and sends them back to the agreement; a
 * second press, still unticked, agrees.
 *
 * What it holds the pages to:
 *  - the approved words, exactly, with the "later in the portal" sentence under v2 only (under v1
 *    portal Settings can't turn texts on);
 *  - consent stays optional: the notice says so, a second press always agrees, nothing ticks the
 *    box, and the server never asks for it;
 *  - every plan with a receptionist gets it; a website-only order (no opt-in) never does.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

register("./next-link-hook.mjs", import.meta.url);

const notice = await import("../app/lib/sms-skip-notice.mjs");
const { default: SmsSkipNotice } = await import("../app/components/agreement/SmsSkipNotice.tsx");
const { validateAgreementSubmission } = await import("../app/lib/agreement-validate.mjs");
const { agreementSubmissionError, agreementConsentError } = await import("../app/lib/agreement-link.mjs");

/** Approved word for word by Xander, 2026-11-15. */
const TITLE = "Continue without text alerts?";
const BODY_V1 =
    "Without text alerts, we won't text you when your AI receptionist takes a call. Every call still reaches your portal inbox, so you would need to check it yourself. Text alerts are optional. To turn them on, tick the box and add your mobile number. To agree without them, press Agree again.";
const BODY_V2 =
    "Without text alerts, we won't text you when a new lead comes in or your AI receptionist takes a call. Every lead and call still reaches your portal inbox, so you would need to check it yourself. Text alerts are optional. To turn them on, tick the box and add your mobile number. To agree without them, press Agree again. You can also turn them on later in your portal Settings.";
const BUTTON = "Back to the agreement";
/**
 * The self-serve page's button reads "Sign & continue to payment →", so its last sentence names
 * that (approved word for word by Xander 2026-11-15, that page only, both campaigns).
 */
const SELF_SERVE_V1 =
    "Without text alerts, we won't text you when your AI receptionist takes a call. Every call still reaches your portal inbox, so you would need to check it yourself. Text alerts are optional. To turn them on, tick the box and add your mobile number. To agree without them, press Sign & continue to payment again.";
const SELF_SERVE_V2 =
    "Without text alerts, we won't text you when a new lead comes in or your AI receptionist takes a call. Every lead and call still reaches your portal inbox, so you would need to check it yourself. Text alerts are optional. To turn them on, tick the box and add your mobile number. To agree without them, press Sign & continue to payment again. You can also turn them on later in your portal Settings.";

test("each campaign's notice, on each page, is in its own approved words", () => {
    assert.deepEqual(notice.smsSkipNoticeCopy("sms-consent-v1", "link"), { title: TITLE, body: BODY_V1, button: BUTTON });
    assert.deepEqual(notice.smsSkipNoticeCopy("sms-consent-v2", "link"), { title: TITLE, body: BODY_V2, button: BUTTON });
    assert.deepEqual(notice.smsSkipNoticeCopy("sms-consent-v1", "self-serve"), { title: TITLE, body: SELF_SERVE_V1, button: BUTTON });
    assert.deepEqual(notice.smsSkipNoticeCopy("sms-consent-v2", "self-serve"), { title: TITLE, body: SELF_SERVE_V2, button: BUTTON });
    // Anything but v2 is v1, as the campaign switch is.
    assert.equal(notice.smsSkipNoticeCopy("unknown", "link").body, BODY_V1);
});

test("each campaign shows only its own body, and v1 claims no new-lead text and no portal opt-in", async () => {
    // The campaign comes from OWNER_TEXT_CAMPAIGN, through the opt-in's own copy, exactly as the pages get it.
    const { smsConsentCopy } = await import("../app/lib/sms-consent-text.ts");
    const saved = process.env.OWNER_TEXT_CAMPAIGN;
    try {
        delete process.env.OWNER_TEXT_CAMPAIGN;
        const v1 = notice.smsSkipNoticeCopy(smsConsentCopy().version, "link");
        assert.equal(v1.body, BODY_V1);
        assert.ok(!v1.body.includes(BODY_V2));
        // v1 neither sends nor registers new-lead texts, and its portal Settings turn texts off only.
        assert.doesNotMatch(v1.body, /lead|later|portal Settings/);

        process.env.OWNER_TEXT_CAMPAIGN = "v2";
        const v2 = notice.smsSkipNoticeCopy(smsConsentCopy().version, "link");
        assert.equal(v2.body, BODY_V2);
        assert.notEqual(v2.body, BODY_V1);
    } finally {
        if (saved === undefined) delete process.env.OWNER_TEXT_CAMPAIGN;
        else process.env.OWNER_TEXT_CAMPAIGN = saved;
    }
});

test("the notice says plainly that texts are optional and that they can agree without them", () => {
    for (const v of ["sms-consent-v1", "sms-consent-v2"]) {
        const link = notice.smsSkipNoticeCopy(v, "link").body;
        assert.ok(link.includes("Text alerts are optional."));
        assert.ok(link.includes("To agree without them, press Agree again."));
        const selfServe = notice.smsSkipNoticeCopy(v, "self-serve").body;
        assert.ok(selfServe.includes("Text alerts are optional."));
        assert.ok(selfServe.includes("To agree without them, press Sign & continue to payment again."));
        assert.ok(!selfServe.includes("press Agree again"), "the self-serve page has no Agree button");
    }
});

test("only the first unticked press shows it; a second press agrees; a ticked box or a website-only order never sees it", () => {
    const due = (o) => notice.smsSkipNoticeDue({ hasReceptionist: true, smsConsent: false, alreadyShown: false, ...o });
    assert.equal(due({}), true, "first press, unticked");
    assert.equal(due({ alreadyShown: true }), false, "second press agrees, still unticked");
    assert.equal(due({ smsConsent: true }), false, "ticked");
    assert.equal(due({ hasReceptionist: false }), false, "website-only: no opt-in, no notice");
});

test("the notice renders as a labelled dialog with one button that goes back, and no checkbox", () => {
    const html = renderToStaticMarkup(createElement(SmsSkipNotice, { copy: notice.smsSkipNoticeCopy("sms-consent-v1", "link"), onBack: () => {} }));
    assert.match(html, /role="alertdialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /aria-labelledby="sms-skip-notice-title"/);
    const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
    assert.ok(text.includes(TITLE));
    assert.ok(text.includes(BODY_V1));
    assert.equal((html.match(/<button/g) ?? []).length, 1, "one button");
    assert.ok(text.includes(BUTTON));
    assert.doesNotMatch(html, /type="checkbox"/, "it can't tick anything");
});

test("the server never asks for the notice or for consent: an unticked, blank submission agrees", () => {
    const now = "2026-11-15T15:00:00.000Z";
    assert.equal(
        validateAgreementSubmission({
            plan: "growth",
            clientLegalName: "Rivera Plumbing & Drain LLC",
            clientEntityType: "LLC",
            clientAddress: "1420 Example Ave, Orlando, FL 32801",
            signerName: "Marisol Rivera",
            signerTitle: "Owner",
            signerEmail: "marisol@riverapd.example",
            pageOpenedAt: now,
            scrollCompletedAt: now,
            receptionistMode: "published",
            termsAccepted: true,
        }),
        null,
    );
    const link = { accepted: true, termsHash: "h", pageOpenedAt: now, scrollCompletedAt: now };
    assert.equal(agreementSubmissionError(link, "h") ?? agreementConsentError(link, { receptionistMode: "forwarded" }), null);
});

/* ── the pages ────────────────────────────────────────────────────────────── */

for (const file of ["app/components/agreement/AgreeLinkClient.tsx", "app/components/agreement/AgreementClient.tsx"]) {
    test(`${file}: shows the notice after every other check and before it posts, and never ticks the box`, () => {
        const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
        const phone = src.indexOf("alertPhoneProblem(");
        const due = src.indexOf("smsSkipNoticeDue(");
        const post = src.search(/[fF]etch\(\s*[`"]\/api\/agree/);
        assert.ok(due > 0, "calls smsSkipNoticeDue");
        assert.ok(phone > 0 && phone < due, "a bad number is reported before the notice");
        assert.ok(due < post, "the notice comes before anything is recorded");
        assert.match(src, /<SmsSkipNotice\b/);
        const page = file.endsWith("AgreeLinkClient.tsx") ? "link" : "self-serve";
        assert.ok(src.includes(`smsSkipNoticeCopy(smsConsentCopy.version, "${page}")`), "the opt-in's campaign, and this page's own button");
        assert.doesNotMatch(src, /setSmsConsent\(true\)/, "nothing ticks the box for them");
    });
}
