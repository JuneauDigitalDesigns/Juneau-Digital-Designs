"use client";

import { useRouter } from "next/navigation";
import LeadForm from "@/app/components/lead/LeadForm";
import { markLeadSent } from "@/app/lib/lead-conversion";

/**
 * The Get Started form, in the homepage hero (Xander, 19 Nov 2026: "get rid of the drawer and take
 * the entire form and put it in the hero"). Approved from the homepage mockup, rounds 1-3.
 *
 * Drawn as a slip of paper on the cream page: an ink rule on top, ruled blanks instead of boxes,
 * the three plans in one row. It is the one thing in the hero with a surface. The form is the
 * shared `LeadForm`, so its words, its human check and its POST are /contact's, not a copy.
 *
 * A successful send does what /contact's does (Xander: "so that the lead can be counted"): it
 * leaves the one-time marker and goes to /contact/thank-you, where the Google Ads conversion fires.
 */
export default function HeroForm() {
    const router = useRouter();
    return (
        <div className="hp-slip" id="start">
            <div className="hp-slip-head">
                <p className="kicker">Tell us about you</p>
                <h2>Let&apos;s talk.</h2>
                <p>
                    A few details and we&apos;ll come back to you with what this would look like for your business. No
                    obligation, no pressure.
                </p>
            </div>
            <LeadForm
                look="slip"
                onSuccess={(business) => {
                    markLeadSent(business);
                    router.push("/contact/thank-you");
                }}
            />
            <p className="hp-eg hp-five">Five quick questions. About 30 seconds.</p>
        </div>
    );
}
