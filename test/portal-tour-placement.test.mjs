/**
 * Where the tour's card sits (Xander, 19 Nov 2026): below the part it outlines whenever there is
 * room, above parts pinned to the bottom of the screen, beside the computer's rail, and centred
 * when there is nothing to point at. `placeCard` is pure, so the rules are checked directly.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { placeCard } from "../app/components/portal/tour/placement.ts";

const phone = { w: 375, h: 812, top: 110, bottom: 724 };
const desktop = { w: 1440, h: 900, top: 12, bottom: 888 };
const card = { w: 351, h: 190 };

test("the card sits below the part when there is room, with its arrow pointing up at it", () => {
    const p = placeCard({ anchor: { x: 16, y: 200, w: 343, h: 120 }, fixed: false, card, viewport: phone, phone: true });
    assert.ok(p.top >= 200 + 120, "below the part");
    assert.equal(p.arrow?.side, "up");
    assert.ok(p.top + card.h <= phone.bottom, "clear of the tab bar");
});

test("a part on the tab bar gets the card above it", () => {
    const p = placeCard({ anchor: { x: 80, y: 740, w: 70, h: 50 }, fixed: true, card, viewport: phone, phone: true });
    assert.ok(p.top + card.h <= 740, "above the tab");
    assert.equal(p.arrow?.side, "down");
});

test("a part too tall for either side gets the card along the bottom, not covering the top bar", () => {
    const p = placeCard({ anchor: { x: 16, y: 120, w: 343, h: 580 }, fixed: false, card, viewport: phone, phone: true });
    assert.equal(p.arrow, null);
    assert.ok(p.top >= phone.top && p.top + card.h <= phone.bottom);
});

test("on a computer, a rail link gets the card beside the rail", () => {
    const p = placeCard({ anchor: { x: 12, y: 300, w: 208, h: 36 }, fixed: true, card: { w: 340, h: 180 }, viewport: desktop, phone: false });
    assert.equal(p.arrow?.side, "left");
    assert.ok(p.left > 220);
});

test("nothing to point at: a centred card with no outline", () => {
    const p = placeCard({ anchor: null, fixed: false, card, viewport: phone, phone: true });
    assert.equal(p.ring, null);
    assert.equal(p.left, Math.round((phone.w - p.width) / 2));
});

test("the outline is clipped to the screen band when the part runs under the bars", () => {
    const p = placeCard({ anchor: { x: 16, y: 60, w: 343, h: 100 }, fixed: false, card, viewport: phone, phone: true });
    assert.ok(p.ring.y >= phone.top - 5);
});
