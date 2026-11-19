/**
 * The homepage's "What your customers are trying to find out." section: searches from every trade
 * and the questions people ask on a call, each fading out and back in with the next one.
 *
 * Approved by Xander from the homepage mockup (rounds 1-3, 19 Nov 2026,
 * https://claude.ai/artifact/TuaQSED4zBHvbTof2RLM6T). No monthly counts here, by his rule; they are
 * kept for the trade pages (`trade-searches.ts`, `hvac-searches.ts`). `test/homepage.test.mjs`
 * fails if a search here is not in one of those sourced lists.
 *
 * `FIRST` is what each slot shows on load; `NEXT` is the queue the slots take from, in order, so
 * the lines on screen together come from different trades.
 */

export interface FoundLine {
    text: string;
    /** The label under the line. */
    trade: string;
}

export const SEARCHES_FIRST: FoundLine[] = [
    { text: "ac repairs near me", trade: "HVAC" },
    { text: "plumbers near me", trade: "Plumbing" },
    { text: "roof repair near me", trade: "Roofing" },
    { text: "lawn mowing service", trade: "Lawn care" },
    { text: "power washing near me", trade: "Pressure washing" },
    { text: "car detailing near me", trade: "Detailing" },
];

export const SEARCHES_NEXT: FoundLine[] = [
    { text: "why is my ac not blowing cold air", trade: "HVAC" },
    { text: "water heater repairs", trade: "Plumbing" },
    { text: "roof leak repair", trade: "Roofing" },
    { text: "lawn care services", trade: "Lawn care" },
    { text: "house pressure washing near me", trade: "Pressure washing" },
    { text: "hvac companies near me", trade: "HVAC" },
    { text: "plumbing repair near me", trade: "Plumbing" },
    { text: "roof replacement cost", trade: "Roofing" },
    { text: "lawn maintenance", trade: "Lawn care" },
    { text: "soft wash roof cleaning", trade: "Pressure washing" },
    { text: "how long do ac units last", trade: "HVAC" },
    { text: "water heater replacement cost", trade: "Plumbing" },
    { text: "roof inspection", trade: "Roofing" },
    { text: "driveway cleaning service", trade: "Pressure washing" },
    { text: "air conditioner service near me", trade: "HVAC" },
    { text: "ac repairs near me", trade: "HVAC" },
    { text: "plumbers near me", trade: "Plumbing" },
    { text: "roof repair near me", trade: "Roofing" },
    { text: "lawn mowing service", trade: "Lawn care" },
    { text: "power washing near me", trade: "Pressure washing" },
    { text: "car detailing near me", trade: "Detailing" },
];

/** The first three are /hvac's, approved; the rest come from each trade's portal-tour sample leads. */
export const ASKED_FIRST: FoundLine[] = [
    { text: "Can someone come today?", trade: "Every trade" },
    { text: "Do you work in my town?", trade: "Every trade" },
    { text: "Do you have a maintenance plan?", trade: "HVAC" },
];

export const ASKED_NEXT: FoundLine[] = [
    { text: "Is a soft wash safe for shingles?", trade: "Pressure washing" },
    { text: "Would polishing take those scratches out?", trade: "Detailing" },
    { text: "Could those brown patches be grubs?", trade: "Lawn care" },
    { text: "Why is my shower pressure so low?", trade: "Plumbing" },
    { text: "Is that a repair or a replacement?", trade: "Roofing" },
    { text: "Can I get a quote this week?", trade: "Every trade" },
    { text: "Can someone come today?", trade: "Every trade" },
    { text: "Do you work in my town?", trade: "Every trade" },
    { text: "Do you have a maintenance plan?", trade: "HVAC" },
];

/** How long each slot holds a line before it fades, in ms, slot by slot (the mockup's timings). */
export const SEARCH_HOLDS = [4300, 5100, 3900, 4700, 5500, 4100];
export const ASKED_HOLDS = [5200, 6100, 4600];
