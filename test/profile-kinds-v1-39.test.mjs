/**
 * @jdd/schema v1.39.0 (2026-11-17) adds LinkedIn, YouTube, TikTok and X as profile kinds. Before
 * it, the sales tool's lead card offered them but the schema stored each as "other".
 *
 * Here that changes two things:
 *  - a profile link of one of those kinds must be on that platform's own site, like every other kind;
 *  - the client's onboarding wizard stays exactly as it was. Its "Other profiles" chips came
 *    straight from PROFILE_KINDS, so the bump alone would have shown four new chips, each needing
 *    a "how to find your link" line that nobody has approved. The chips are now their own list,
 *    and a new kind joins it only with approved copy.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { PROFILE_KINDS } from "@jdd/schema";
import { PROFILE_HOWTO, PROFILE_SHORT, WIZARD_PROFILE_KINDS } from "../app/components/onboarding/wizard/copy-service-details.ts";
import { profileLinkProblem } from "../app/lib/profile-links.ts";

const NEW = {
    linkedin: "https://www.linkedin.com/company/peak-home",
    youtube: "https://www.youtube.com/@peakhome",
    tiktok: "https://www.tiktok.com/@peakhome",
    x: "https://x.com/peakhome",
};

test("the wizard offers the same profiles as before, each with its approved how-to line", () => {
    assert.deepEqual([...WIZARD_PROFILE_KINDS], ["google", "facebook", "yelp", "bbb", "angi", "nextdoor", "instagram", "other"]);
    for (const k of WIZARD_PROFILE_KINDS) if (k !== "other") assert.ok(PROFILE_HOWTO[k], `${k}: no how-to line`);
    // Every chip is a real schema kind, in the schema's order.
    const order = WIZARD_PROFILE_KINDS.map((k) => PROFILE_KINDS.indexOf(k));
    assert.ok(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])), "chips out of the schema's order");
});

test("every schema kind has its platform's name, the four new ones included", () => {
    for (const k of PROFILE_KINDS) assert.ok(PROFILE_SHORT[k], `${k}: no name`);
    assert.deepEqual(
        Object.keys(NEW).map((k) => PROFILE_SHORT[k]),
        ["LinkedIn", "YouTube", "TikTok", "X"],
    );
});

test("a LinkedIn, YouTube, TikTok or X link must be on that platform's own site", () => {
    for (const [kind, url] of Object.entries(NEW)) {
        assert.equal(profileLinkProblem(kind, url), "", `${kind}: its own link was refused`);
        const other = kind === "youtube" ? NEW.tiktok : NEW.youtube;
        assert.equal(profileLinkProblem(kind, other), "wrong-site", `${kind}: another platform's link was accepted`);
    }
    assert.equal(profileLinkProblem("x", "https://twitter.com/peakhome"), "", "twitter.com is still X");
    assert.equal(profileLinkProblem("youtube", "https://youtu.be/abc123"), "", "youtu.be is YouTube");
});
