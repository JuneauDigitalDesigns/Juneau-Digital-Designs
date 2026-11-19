/**
 * /contact and /contact/thank-you.
 *
 * Xander approved every sentence from the round-1 mockup (19 Nov 2026). These tests pin that
 * wording, that the form is the shared `LeadForm` (not a copy, so the abuse check and the approved
 * fields have one home), that the thank-you page is kept out of search and the sitemap, and that
 * the Google Ads conversion is wired but not accidentally shipped switched on.
 *
 * On the code before this change every test here fails: there is no `app/contact/`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import {
    PUBLIC_PATHS,
    SITE_URL,
    CONTACT_TITLE,
    CONTACT_DESCRIPTION,
    contactJsonLd,
} from "../app/lib/site-seo.ts";
import { CONTACT_STEPS } from "../app/data/contact-steps.ts";
import { GOOGLE_ADS_TAG_ID, LEAD_CONVERSION_LABEL, leadConversionTarget } from "../app/data/google-ads.ts";
import { CONTACT } from "../app/data/contact.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
const prose = (src) => src.replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const page = prose(read("app/contact/page.tsx"));
const thankYou = prose(read("app/contact/thank-you/ThankYouClient.tsx"));
const leadForm = prose(read("app/components/lead/LeadForm.tsx"));

function says(src, sentences, where) {
    for (const s of sentences) assert.ok(src.includes(s), `${where} no longer says: ${s}`);
}

test("the contact hero and the ways to reach us are the approved words", () => {
    says(
        page,
        [
            "Let&apos;s <span className=\"contact-coral\">talk.</span>".replace(/&apos;/g, "'"),
            "A few details and we'll come back to you with what this would look like for your business. No obligation, no pressure.",
            "Call us",
            "Email us",
            "Need to hear it first? Call the demo.",
            "The AI receptionist picks up. Ask it anything.",
        ],
        "/contact",
    );
    // The phone, email and demo number are the site's real ones, read from their own files.
    assert.ok(page.includes("CONTACT.phoneHref") && page.includes("CONTACT.phoneDisplay"), "the phone is not CONTACT's");
    assert.ok(page.includes("CONTACT.emailHref") && page.includes("CONTACT.email"), "the email is not CONTACT's");
    assert.ok(page.includes("DEMO_TEL") && page.includes("DEMO_TEL_DISPLAY"), "the demo line is not demo-line's");
});

test("the form is the shared LeadForm, not a copy, and sends to the thank-you page", () => {
    // The contact page renders the same component the homepage hero does.
    assert.match(read("app/contact/ContactForm.tsx"), /from "@\/app\/components\/lead\/LeadForm"/);
    assert.match(read("app/components/home/HeroForm.tsx"), /from "@\/app\/components\/lead\/LeadForm"/);
    // The approved fields and the human check live in LeadForm, once.
    says(
        leadForm,
        [
            "Your name",
            "Business name",
            "Best number to reach you",
            "Interested in",
            "Not sure? Skip it. We'll figure it out together.",
            "Anything else? (optional)",
            "Name, business, and a phone number, please.",
            "Rather just hear it work?",
            "Call the agent",
        ],
        "LeadForm",
    );
    assert.match(read("app/components/lead/LeadForm.tsx"), /fetch\("\/api\/lead"/, "LeadForm no longer posts to /api/lead");
    assert.match(read("app/components/lead/LeadForm.tsx"), /useTurnstile/, "LeadForm dropped the human check");
    // A successful send on /contact leaves the marker and goes to the thank-you page.
    assert.match(read("app/contact/ContactForm.tsx"), /markLeadSent\(business\)/);
    assert.match(read("app/contact/ContactForm.tsx"), /router\.push\("\/contact\/thank-you"\)/);
});

test("what happens after you send: the five steps, Schedule-A promises included", () => {
    assert.deepEqual(
        CONTACT_STEPS.map((s) => s.title),
        ["We reach out", "You pick a plan", "You answer a few questions", "Your preview site", "You're live"],
    );
    assert.equal(CONTACT_STEPS[3].when, "Within 72 hours");
    assert.equal(CONTACT_STEPS[4].when, "Within a week");
    says(
        page,
        [
            "What happens after <span className=\"contact-coral\">you send.</span>",
            "From this form to a live site and a receptionist answering your calls.",
        ],
        "/contact",
    );
});

test("before you ask: three questions, read from the FAQ's own entries", () => {
    says(page, ['Before you <span className="contact-coral">ask.</span>', "All questions"], "/contact");
    // The answers are not retyped here; the page reads them from FAQ_GROUPS by question.
    assert.match(read("app/contact/page.tsx"), /from "@\/app\/data\/faq"/);
    assert.ok(page.includes('"Am I locked into a contract?"'), "the contract question is gone");
    assert.ok(page.includes('"Do I have to write the content?"'), "the write-content question is gone");
    assert.ok(page.includes('"What if I already have a website?"'), "the already-have-a-site question is gone");
    assert.match(read("app/contact/page.tsx"), /href="\/faq"/, "the All questions link is gone");
});

test("the thank-you page shows the approved words and the business name from the browser", () => {
    says(
        thankYou,
        [
            "Got it",
            "We&apos;ll be <span className=\"contact-coral\">in touch.</span>".replace(/&apos;/g, "'"),
            "Someone will reach out about",
            "shortly. In the meantime, the fastest way to understand what we do is to hear it.",
            "You&apos;re <span className=\"contact-coral\">here.</span>".replace(/&apos;/g, "'"),
            "You sent the form",
            "While you wait, <span className=\"contact-coral\">hear it.</span>",
            "Call the demo line. The AI receptionist picks up, the way it would for your customers.",
            "Back to the homepage",
        ],
        "/contact/thank-you",
    );
    // The business name comes from the marker, defaulting to "your business"; the marker is read
    // once (taken) so a refresh never re-counts.
    assert.match(read("app/contact/thank-you/ThankYouClient.tsx"), /\|\| "your business"/);
    assert.match(read("app/contact/thank-you/ThankYouClient.tsx"), /takeLeadMarker\(\)/);
    assert.match(read("app/contact/thank-you/ThankYouClient.tsx"), /fireLeadConversion\(\)/);
});

test("the thank-you page is noindex and never in the sitemap", () => {
    const tyPage = read("app/contact/thank-you/page.tsx");
    assert.match(tyPage, /robots: \{ index: false, follow: false \}/);
    assert.ok(!PUBLIC_PATHS.includes("/contact/thank-you"), "/contact/thank-you must not be a public path");
    assert.ok(
        !sitemap().some((e) => e.url.includes("/contact/thank-you")),
        "/contact/thank-you must not be in the sitemap",
    );
});

test("the Google Ads conversion is wired but shipped off until Xander supplies the tag", () => {
    assert.equal(GOOGLE_ADS_TAG_ID, null, "the Google Ads tag id must not be committed set");
    assert.equal(LEAD_CONVERSION_LABEL, null, "the conversion label must not be committed set");
    assert.equal(leadConversionTarget(), null, "with no tag there is no conversion target");
    // The gtag loader renders nothing while the tag is null.
    assert.match(read("app/components/GoogleAdsScript.tsx"), /if \(!GOOGLE_ADS_TAG_ID\) return null/);
});

test("/contact has its approved title, description, canonical, sitemap entry and links in", () => {
    assert.equal(CONTACT_TITLE, "Contact Juneau Digital Designs | Website + AI Receptionist");
    assert.equal(
        CONTACT_DESCRIPTION,
        `Tell us about your business and we'll come back to you with what a website and a 24/7 AI receptionist would look like for it. Or call ${CONTACT.phoneDisplay}.`,
    );
    assert.match(read("app/contact/page.tsx"), /pageMetadata\("\/contact", CONTACT_TITLE, CONTACT_DESCRIPTION\)/);
    assert.ok(PUBLIC_PATHS.includes("/contact"), "/contact is not a public path");
    assert.ok(sitemap().some((e) => e.url === `${SITE_URL}/contact`), "/contact is missing from the sitemap");
    assert.match(read("app/components/footer/footer.tsx"), /href="\/contact"/, "the footer does not link to /contact");
    assert.match(read("app/components/navbar/navbar.tsx"), /href="\/contact"/, "the nav does not link to /contact");
});

test("the contact structured data says only what the page says", () => {
    const ld = contactJsonLd();
    assert.equal(ld["@type"], "ContactPage");
    assert.equal(ld.url, `${SITE_URL}/contact`);
    assert.equal(ld.mainEntity.telephone, CONTACT.phoneHref.replace(/^tel:/, ""));
    assert.equal(ld.mainEntity.email, CONTACT.email);
    // No address or opening hours: the page lists none.
    assert.equal(ld.mainEntity.address, undefined);
    assert.equal(ld.mainEntity.openingHours, undefined);
});
