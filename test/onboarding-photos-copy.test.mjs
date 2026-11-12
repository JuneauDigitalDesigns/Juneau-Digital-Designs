/**
 * The onboarding wizard's photo wording, approved word for word by Xander on 2026-11-11
 * ("Approve as drafted", mockup https://claude.ai/artifact/P1VQn1Ry22JgnkdXEVAfQ5). These pin the
 * exact strings so an edit can't drift from what he approved.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { C } from "../app/components/onboarding/wizard/copy-service-details.ts";

test("general Photos step wording (P1 to P4, P7)", () => {
    assert.equal(C.photosQ, "Do you have photos of your completed work or your business?");
    assert.equal(C.photosHelp, "Finished jobs, your trucks, your shop, your team at work. Add what you have.");
    assert.equal(C.photosLabel, "Your photos");
    assert.equal(C.photosLabelNote, "Up to 10. These go at the top of your homepage.");
    assert.equal(C.dropHint, "Drag photos here or tap to choose");
    assert.equal(C.dropLimits, "PNG, JPG or WebP, up to 10 MB each.");
    assert.equal(C.welcomePhotos, "Your logo and some photos of your work or your business. No logo or photos yet? That's fine, we'll sort it.");
});

test("each service's photos wording (S1 to S4)", () => {
    assert.equal(C.qPhotos, "Photos of you doing this work");
    assert.equal(C.hPhotos, "Up to 3. The first one becomes this service's picture across your site. The rest show on its page.");
    assert.equal(C.ghostPhotos, "+ Photos of you doing this work");
    assert.equal(C.addsPhotos, "Adds your photos to this service's page.");
});

test("no approved photo string uses an en or em dash", () => {
    for (const v of [C.photosQ, C.photosHelp, C.photosLabel, C.photosLabelNote, C.dropHint, C.dropLimits, C.workCap, C.welcomePhotos, C.qPhotos, C.ghostPhotos]) {
        assert.doesNotMatch(v, /[–—]/, v);
    }
});
