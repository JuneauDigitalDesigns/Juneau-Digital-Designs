"use client";

import { useEffect, useState } from "react";
import SvcIcon from "./SvcIcon";
import { useRotator } from "./useRotator";

/**
 * /website-design, "Built to be found": one search result, turning through six trades.
 *
 * Every search is a real one, from the lists the site already prints with their sources
 * (`hvac-searches.ts`, `trade-searches.ts`: Marketkeep from Google Keyword Planner; Ranktracker
 * for detailing). The result under each is a made-up business, "Your Business Co.", so it can never
 * read as one of ours, and the page says it is an example. `test/service-pages.test.mjs` holds
 * each search to those lists.
 */
export const FOUND_SEARCHES: { trade: string; search: string; slug: string; title: string; desc: string }[] = [
    {
        trade: "HVAC",
        search: "ac repairs near me",
        slug: "ac-repair",
        title: "AC Repair | Your Business Co.",
        desc: "AC not cooling? We find the problem and fix it, from refrigerant leaks to worn-out parts. Call for an estimate.",
    },
    {
        trade: "Plumbing",
        search: "plumbers near me",
        slug: "plumbing",
        title: "Plumbing Services | Your Business Co.",
        desc: "Leaks, clogs, water heaters and burst pipes. Tell us what's wrong and we'll call you right back.",
    },
    {
        trade: "Roofing",
        search: "roof repair near me",
        slug: "roof-repair",
        title: "Roof Repair | Your Business Co.",
        desc: "Leaks, missing shingles and storm damage, inspected and repaired. Call to book an inspection.",
    },
    {
        trade: "Lawn care",
        search: "lawn care services",
        slug: "lawn-care",
        title: "Lawn Care Services | Your Business Co.",
        desc: "Weekly mowing, edging and seasonal cleanups, on a schedule that suits you. Ask for a quote.",
    },
    {
        trade: "Pressure washing",
        search: "power washing near me",
        slug: "power-washing",
        title: "Power Washing | Your Business Co.",
        desc: "Driveways, siding, decks and roofs, cleaned without damage. Ask for a quote.",
    },
    {
        trade: "Detailing",
        search: "car detailing near me",
        slug: "car-detailing",
        title: "Car Detailing | Your Business Co.",
        desc: "Hand washes, interior details and ceramic coating, at your home or at the shop.",
    },
];

export default function SearchResult() {
    const [picked, pick] = useRotator(FOUND_SEARCHES.length, 3800);
    const [shown, setShown] = useState(0);
    /* While the picked trade and the shown one differ, the result is fading out. */
    const swapping = picked !== shown;

    /* The result fades out, takes the new trade's words, and fades back in. */
    useEffect(() => {
        if (picked === shown) return;
        const t = window.setTimeout(() => setShown(picked), 280);
        return () => window.clearTimeout(t);
    }, [picked, shown]);

    const s = FOUND_SEARCHES[shown];
    return (
        <div>
            <div className="svc-serp-trades" role="group" aria-label="Pick a trade">
                {FOUND_SEARCHES.map((t, i) => (
                    <button key={t.trade} type="button" aria-pressed={picked === i} onClick={() => pick(i)}>
                        {t.trade}
                    </button>
                ))}
            </div>
            <div className="svc-serp" aria-label="Example search result for a client site" aria-live="polite">
                <div className="svc-serp-q">
                    <SvcIcon name="search" />
                    <span>{s.search}</span>
                </div>
                <div className={`svc-serp-body${swapping ? " swap" : ""}`}>
                    <span className="svc-serp-u">yourbusinessco.com › {s.slug}</span>
                    <span className="svc-serp-t">{s.title}</span>
                    <span className="svc-serp-d">{s.desc}</span>
                </div>
                <span className="svc-pin" style={{ top: 122 }} aria-hidden="true">
                    1
                </span>
                <span className="svc-pin" style={{ top: 168 }} aria-hidden="true">
                    2
                </span>
            </div>
            <p className="svc-eg" style={{ marginTop: 12 }}>
                <span className="svc-tag">Example</span> A made-up business. Not a promise about where anyone ranks.
            </p>
        </div>
    );
}
