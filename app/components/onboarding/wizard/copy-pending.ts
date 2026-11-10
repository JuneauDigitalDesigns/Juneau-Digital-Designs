/**
 * Every client-facing string added for service details, online profiles and the address
 * question (onboarding-facts, 2026-11-10).
 *
 * ── PENDING APPROVAL ─────────────────────────────────────────────────────────
 * These are the DRAFT words from the copy deck sent to Xander on 2026-11-10 (mockup
 * https://claude.ai/artifact/K9iQcYFjUkaPp1fFRoLJMd, items #3 to #47). He approves them word for
 * word. Until he does, this file must not ship: the PR stays a draft. Each string carries its
 * deck number so his "approve 12, change 24 to …" reply maps onto one line here.
 * Items #1 and #2 (timings) were approved on 2026-11-10 and live in screens.tsx and model.ts.
 *
 * The page headings the "earns" tags quote ("What's included", "Signs it's time to call",
 * "Starting at", "Common questions", "Brands we work with", "Areas we serve") were approved on
 * 2026-11-10 for the service page itself (service-page-spec.md §3) and are reused as is.
 */

import type { ProfileKind } from "@jdd/schema";

export const APPROVED = false;

export const C = {
    // Contact (#3 to #7)
    addressNote: "Used to find your local area.", // #3
    visitLabel: "Do customers come to this address?", // #4
    visitYes: "Yes, customers visit us", // #5
    visitNo: "No, we go to them", // #5
    visitYesNote: "We'll show it on your site so customers can find you.", // #6
    visitNoNote: "We'll keep your street address off your site and show your town instead.", // #7

    // Towns (#8, #9)
    townsCount: (n: number) => `${n} added, up to 20`, // #8
    townsCap: "Up to 20 towns. That's Google's limit too.", // #9

    // Online profiles (#10 to #19)
    onlineNav: "Online profiles", // #10
    onlineQ: "Where can customers find you online?", // #11
    onlineHelp: "We link these from your site, and they help Google match your site to your business.", // #12
    mostImportant: "Most important", // #14
    googleNote: "On Google Maps, open your business, tap Share, and paste the link here.", // #15
    pasteLink: "Paste the link", // #16
    noProfiles: "No profiles yet? That's fine, skip this.", // #17
    linkNotLink: "That doesn't look like a link. Try copying it again.", // #18
    linkWrongSite: (site: string, howTo: string) => `That isn't a ${site} link. ${howTo}`, // #18
    linkSearch: "That's a search page, not your profile. Open your business, then tap Share.", // #18
    profilesSummary: (n: number) => `${n} profiles`, // #19

    // Reviews (#20, #21)
    reviewsFrom: "Where are these reviews from?", // #20
    reviewsFromNote: "From the profiles you gave us. Your rating badge links there.", // #21

    // Service details list (#22 to #29)
    detailsNav: "Service details", // #22
    detailsQ: "Tell us a bit more about each service", // #23
    detailsHelp:
        "A service with a few real details gets its own page on your site. Those pages are how people find you when they search for one job. Do as many as you like.", // #24
    tally: (n: number, m: number) => `${n} of ${m} ready for their own page`, // #25
    stReady: "Ready for its own page", // #26
    stNear: "One more detail for its own page", // #26
    stCore: "Add what's included to unlock its page", // #26
    stNone: "No details yet", // #26
    addDetails: "Add details →", // #27
    edit: "Edit", // #27
    detailsFoot: "Services without details still show on your Services page.", // #28
    servicesSummary: (n: number, k: number) => `${n} services, ${k} with their own page`, // #29

    // One service (#30 to #42)
    allServices: "← All services", // #30
    serviceOf: (i: number, m: number) => `Service ${i} of ${m}`, // #30
    nextService: "Next service", // #30
    done: "Done", // #30
    banNear: "One more detail for its own page. Any one below will do.", // #31
    banCore: "Add what's included, or 2 jobs customers call about, to unlock its page.", // #31
    banReady: "✓ Ready for its own page on your site", // #31
    qIncluded: "What's included?", // #32
    qJobs: "What do customers call you about?", // #32
    qPrice: "Starting price", // #32
    qQuestions: "What do customers ask about this?", // #32
    qPhotos: "Photos of this job", // #32
    qBrands: "Brands you use for this", // #32
    qAreas: "Where do you do this?", // #32
    hIncluded: "Tap what's part of the job, or add your own.", // #33
    hJobs: "The problems that bring people to you, in their words. These are what they type into Google.", // #34
    hPrice: 'Only if you\'re happy to share. Shown as "Starting at $X" on this service.', // #35
    hQuestions: "Tap the questions you hear. Add a short answer in your own words if you like. We only use what you tell us.", // #36
    hPhotos: "Up to 3. The first one becomes this service's picture across your site. The rest show on its page.", // #37
    photosCap: "Up to 3 photos per service.", // #37
    listCap: (n: number) => `Up to ${n} for each service.`, // #37
    hBrands: "Tap any that apply. They're added to your Brands list too.", // #38
    areasAll: "Everywhere I cover", // #39
    areasSome: "Only some towns", // #39
    // #40: the "earns" tags quote the approved service-page headings, plus one new phrase.
    earnIncluded: '+ "What\'s included"',
    earnJobs: '+ "Signs it\'s time to call"',
    earnPrice: '+ "Starting at"',
    earnQuestions: '+ "Common questions"',
    earnBrands: '+ "Brands we work with"',
    earnAreas: '+ "Areas we serve"',
    earnPhotos: "+ Your photos", // #40
    vPicked: (n: number) => `${n} picked`, // #41
    vNone: "None yet", // #41
    vNotShared: "Not shared", // #41
    vEverywhere: "Everywhere you cover", // #41
    vSomeTowns: (n: number, m: number) => `${n} of your ${m} towns`, // #41
    vUpTo3: "Up to 3", // #41
    addIncluded: "Something else that's included?", // #42
    addJobs: "Something else they call about?", // #42
    addQuestion: "Another question customers ask?", // #42
    answerPh: "Your answer, in a few words", // #42

    // How long it takes (#48 to #52; question and chips are Xander's own words, 2026-11-10)
    qDuration: "How long does it usually take?", // #48
    durationChips: ["Under an hour", "Half a day", "A full day", "A few days"], // #49
    hDuration: "Roughly, for a typical job. Only if you're sure.", // #50
    addDuration: "Something else, like 2 to 3 hours", // #51
    earnExpect: '+ "What to expect"', // #52, the approved page heading
    ghostExpect: '+ "What to expect": add how long it usually takes', // #55

    // Wireframe labels (#43 to #45)
    capPages: "Your pages so far", // #43
    capService: "Wireframe of this service's page", // #43
    capServicePhone: "This service's page, not the final design", // #43
    pgOwn: "its own page", // #44
    pgNear: "1 more detail", // #44
    pgCore: "needs what's included", // #44
    pgAll: (m: number) => `all ${m} services`, // #44
    ghostJobs: '+ "Signs it\'s time to call": add what customers call you about', // #45
    ghostPrice: '+ "Starting at": add a starting price', // #45
    ghostQuestions: '+ "Common questions": add what customers ask', // #45
    ghostAreas: '+ "Areas we serve": only if it\'s some of your towns', // #45
    ghostPhotos: "+ Photos of this job", // #45
} as const;

/** Field labels and add-chips on the profiles screen (#13). Display order is the footer's. */
export const PROFILE_LABELS: Record<ProfileKind, string> = {
    google: "Google Business Profile",
    facebook: "Facebook page",
    yelp: "Yelp",
    bbb: "BBB",
    angi: "Angi",
    nextdoor: "Nextdoor",
    instagram: "Instagram",
    other: "Another link",
};

/** Short names for the "Where are these reviews from?" chips (#20) and the wrong-site line (#18). */
export const PROFILE_SHORT: Record<ProfileKind, string> = {
    google: "Google",
    facebook: "Facebook",
    yelp: "Yelp",
    bbb: "BBB",
    angi: "Angi",
    nextdoor: "Nextdoor",
    instagram: "Instagram",
    other: "Other",
};

/** The "how to" half of the wrong-site line (#18), per kind. */
export const PROFILE_HOWTO: Record<ProfileKind, string> = {
    google: "Open your business on Google Maps and tap Share.",
    facebook: "Open your Facebook page and copy the link.",
    yelp: "Open your Yelp page and copy the link.",
    bbb: "Open your BBB page and copy the link.",
    angi: "Open your Angi page and copy the link.",
    nextdoor: "Open your Nextdoor page and copy the link.",
    instagram: "Open your Instagram profile and copy the link.",
    other: "",
};
