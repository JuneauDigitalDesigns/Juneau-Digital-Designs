/**
 * The agency's Google and Facebook profiles in the footer (Xander, 25 Nov 2026): his own logos,
 * each linking to the profile he supplied, and the same links as the Organization's `sameAs`.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { PROFILES } from "../app/data/contact.ts";
import { organizationJsonLd } from "../app/lib/site-seo.ts";

test("Google first, then Facebook, with the links Xander gave", () => {
    assert.deepEqual(PROFILES.map((p) => [p.kind, p.href]), [
        ["google", "https://share.google/ZvdenHpUf72HhHG74"],
        ["facebook", "https://www.facebook.com/profile.php?id=61597061243520"],
    ]);
});

test("each logo file exists in public/", () => {
    for (const p of PROFILES) assert.ok(existsSync(`public${p.icon}`), p.icon);
});

test("the footer renders every profile as an outbound rel=me link", () => {
    const src = readFileSync("app/components/footer/footer.tsx", "utf8");
    assert.match(src, /PROFILES\.map/);
    assert.match(src, /rel="me noopener noreferrer"/);
    assert.match(src, /target="_blank"/);
});

test("the Organization lists the same profiles as sameAs", () => {
    const org = organizationJsonLd()["@graph"].find((n) => n["@type"] === "Organization");
    assert.deepEqual(org.sameAs, PROFILES.map((p) => p.href));
});
