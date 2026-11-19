/**
 * Where the tour's card and outline go, in screen coordinates. Pure, so the rules are tested
 * directly (`test/portal-tour-placement.test.mjs`).
 *
 * Xander, 19 Nov 2026: the card sits **below** the part it explains whenever there is room
 * ("the box ... just needs to be moved below the outline highlighted area"). Parts fixed to the
 * bottom of the screen (the phone's tab bar, a text box) take the card above them. A part on the
 * computer's rail takes it to the right, beside the rail. A part too tall to leave room either
 * side gets the card along the bottom, over it. No part: a centred card.
 */

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Placement {
    ring: Box | null;
    top: number;
    left: number;
    width: number;
    arrow: { side: "up" | "down" | "left"; offset: number } | null;
}

const GAP = 14;
const PAD = 5;
const EDGE = 12;
/** The computer's rail is at most this wide; a fixed part inside it is "on the rail". */
const RAIL_MAX = 300;

export function placeCard(opts: {
    anchor: Box | null;
    /** The part is fixed or sticky to the screen (tab bar, rail, a pinned text box). */
    fixed: boolean;
    card: { w: number; h: number };
    /** The usable band of the screen: below the top bar, above the tab bar. */
    viewport: { w: number; h: number; top: number; bottom: number };
    phone: boolean;
}): Placement {
    const { anchor, fixed, card, viewport: vp, phone } = opts;
    const width = Math.min(card.w, vp.w - EDGE * 2);
    const centredLeft = Math.round((vp.w - width) / 2);
    if (!anchor) {
        return { ring: null, top: Math.round(vp.top + (vp.bottom - vp.top - card.h) / 2), left: centredLeft, width, arrow: null };
    }

    // The outline, clipped to the usable band when the part scrolls under the bars.
    const y1 = fixed ? anchor.y : Math.max(anchor.y, vp.top);
    const y2 = fixed ? anchor.y + anchor.h : Math.min(anchor.y + anchor.h, vp.bottom);
    const ring: Box = {
        x: Math.max(3, anchor.x - PAD),
        y: y1 - PAD,
        w: Math.min(vp.w - 6, anchor.x + anchor.w + PAD) - Math.max(3, anchor.x - PAD),
        h: y2 - y1 + PAD * 2,
    };
    const ringBottom = ring.y + ring.h;
    const ringMidX = ring.x + ring.w / 2;
    const clampLeft = (l: number) => Math.max(EDGE, Math.min(vp.w - width - EDGE, l));
    const arrowX = (left: number) => Math.max(18, Math.min(width - 30, ringMidX - left - 7));

    // Computer rail: beside it, vertically centred on the part.
    if (!phone && fixed && anchor.x + anchor.w <= RAIL_MAX) {
        const left = ring.x + ring.w + GAP;
        const top = Math.max(EDGE, Math.min(vp.h - card.h - EDGE, Math.round(ring.y + ring.h / 2 - card.h / 2)));
        return { ring, top, left, width, arrow: { side: "left", offset: Math.max(16, Math.min(card.h - 30, ring.y + ring.h / 2 - top - 7)) } };
    }

    const left = phone ? centredLeft : clampLeft(Math.round(anchor.x));
    const roomBelow = vp.bottom - (ringBottom + GAP);
    const roomAbove = ring.y - GAP - vp.top;
    const pinnedLow = fixed && ring.y > vp.h / 2;

    if (!pinnedLow && roomBelow >= card.h) {
        return { ring, top: Math.round(ringBottom + GAP), left, width, arrow: { side: "up", offset: arrowX(left) } };
    }
    if (roomAbove >= card.h || pinnedLow) {
        return { ring, top: Math.round(ring.y - GAP - card.h), left, width, arrow: { side: "down", offset: arrowX(left) } };
    }
    return { ring, top: Math.round(vp.bottom - card.h - 10), left, width, arrow: null };
}
