/**
 * Vercel Web Analytics reports marketing traffic only. The client portal and the private links
 * (/terms/<code>, /pay/<code>, /start, Stripe's /checkout return pages) are never reported, and
 * a private code must never leave the browser inside a URL.
 *
 * `filterAnalyticsEvent` is the `beforeSend` hook. Returning null is how the package drops an
 * event. Anything else it returns is sent as-is, so the URL it returns is exactly what Vercel
 * receives.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
    analyticsUrl,
    filterAnalyticsEvent,
    isPrivatePath,
} from "../app/lib/analytics-privacy.ts";

const ORIGIN = "https://www.juneaudigitaldesigns.com";
const CODE = "a1B2c3D4e5F6g7H8";

const PRIVATE_URLS = [
    "/portal",
    "/portal/",
    "/portal/calls",
    "/portal/settings/billing",
    "/portal/l/rec123",
    "/portal/sign-in",
    "/portal/sign-up/verify",
    "/portal/onboarding?step=3",
    "/portal/continue",
    `/terms/${CODE}`,
    `/terms/${CODE}?from=sms#sign`,
    "/terms/accept?plan=growth",
    `/pay/${CODE}`,
    `/pay/${CODE}/`,
    "/start",
    "/start?plan=growth",
    "/checkout/success?session_id=cs_live_abc123",
    "/checkout/thanks?cancelled=1",
    // Spellings that must not slip past the prefix check.
    "/Portal/calls",
    "//portal/calls",
    "/%70ortal/calls",
    `/TERMS/${CODE}`,
    `/%74erms/${CODE}`,
];

test("private pages are never reported, as pageviews or as custom events", () => {
    for (const path of PRIVATE_URLS) {
        const url = ORIGIN + path;
        assert.equal(filterAnalyticsEvent({ type: "pageview", url }), null, `pageview ${path}`);
        assert.equal(filterAnalyticsEvent({ type: "event", url }), null, `event ${path}`);
    }
});

test("no reported URL ever contains a private code", () => {
    const urls = [
        ...PRIVATE_URLS.map((p) => ORIGIN + p),
        `${ORIGIN}/?code=${CODE}`,
        `${ORIGIN}/pricing#${CODE}`,
        `${ORIGIN}/about?session_id=cs_live_abc123&utm_source=google`,
    ];
    for (const url of urls) {
        const sent = analyticsUrl(url);
        if (sent !== null) {
            assert.ok(!sent.includes(CODE), `${url} reported as ${sent}`);
            assert.ok(!sent.includes("cs_live"), `${url} reported as ${sent}`);
        }
    }
});

test("the public pages are still reported", () => {
    for (const path of ["/", "/pricing", "/about", "/faq", "/terms", "/terms?plan=growth", "/sms-terms", "/privacy-policy", "/activation", "/portfolio", "/startup-tips", "/payments-guide"]) {
        assert.notEqual(analyticsUrl(ORIGIN + path), null, path);
    }
    assert.equal(isPrivatePath("/terms"), false);
    assert.equal(isPrivatePath("/sms-terms"), false);
});

test("public URLs keep campaign tags and lose everything else", () => {
    assert.equal(
        analyticsUrl(`${ORIGIN}/pricing?utm_source=google&utm_campaign=hvac&gclid=XYZ&email=a@b.co#plans`),
        `${ORIGIN}/pricing?utm_source=google&utm_campaign=hvac`,
    );
    assert.equal(analyticsUrl(`${ORIGIN}/?ref=hn`), `${ORIGIN}/?ref=hn`);
    assert.equal(analyticsUrl(`${ORIGIN}/about`), `${ORIGIN}/about`);
});

test("the event keeps its other fields and is otherwise sent unchanged", () => {
    const sent = filterAnalyticsEvent({ type: "pageview", url: `${ORIGIN}/pricing?fbclid=1` });
    assert.deepEqual(sent, { type: "pageview", url: `${ORIGIN}/pricing` });
});

test("an unparseable URL is dropped, not passed through", () => {
    assert.equal(analyticsUrl(`${ORIGIN}/%E0%A4%A`), null);
});

test("the root layout mounts the filtered component, not a bare <Analytics/>", () => {
    const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
    const layout = read("../app/layout.tsx");
    assert.match(layout, /<SiteAnalytics \/>/);
    assert.doesNotMatch(layout, /@vercel\/analytics/);

    const component = read("../app/components/SiteAnalytics.tsx");
    assert.match(component, /from "@vercel\/analytics\/next"/);
    assert.match(component, /beforeSend=\{filterAnalyticsEvent\}/);
    assert.match(component, /if \(isPrivatePath\(pathname\)\) return null;/);
});
