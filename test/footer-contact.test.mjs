/**
 * The footer's Contact section (Xander, 2026-11-12): the business number and the support email,
 * in the footer only, not the nav.
 *
 * The number Xander pasted carried an invisible U+202C (pop directional formatting) character.
 * A `tel:` link with one in it can fail to dial, and a copied number carries it along, so these
 * pin the clean values and refuse any invisible character in them.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CONTACT } from "../app/data/contact.ts";

const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]/;

test("the number and email are the clean values, exactly", () => {
    assert.deepEqual(CONTACT, {
        phoneDisplay: "(407) 984-7493",
        phoneHref: "tel:+14079847493",
        email: "support@juneaudigitaldesigns.com",
        emailHref: "mailto:support@juneaudigitaldesigns.com",
    });
});

test("no invisible characters in any of them", () => {
    for (const v of Object.values(CONTACT)) assert.doesNotMatch(v, INVISIBLE, JSON.stringify(v));
});

test("the email is plain ASCII, so the mailto link opens a mail app", () => {
    assert.match(CONTACT.email, /^[\x21-\x7e]+@[\x21-\x7e]+$/);
});

const footer = readFileSync("app/components/footer/footer.tsx", "utf8");

test("the footer has a Contact section with both links", () => {
    assert.match(footer, />Contact</);
    assert.match(footer, /href=\{CONTACT\.phoneHref\}/);
    assert.match(footer, /href=\{CONTACT\.emailHref\}/);
});

test("the footer keeps its pages, legal links and credit line", () => {
    for (const href of ["/", "/pricing", "/faq", "/privacy-policy", "/sms-terms", "/terms"]) {
        assert.ok(footer.includes(`href="${href}"`), href);
    }
    assert.match(footer, /All rights reserved\./);
    assert.match(footer, /WEBSITES \/ HOSTING \/ AI RECEPTIONIST/);
});

test("the nav does not carry the number", () => {
    const nav = readFileSync("app/components/navbar/navbar.tsx", "utf8");
    assert.doesNotMatch(nav, /CONTACT\.phone|407\) 984/);
});
