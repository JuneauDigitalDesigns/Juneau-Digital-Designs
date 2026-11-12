/**
 * Every client-facing string added for service details, online profiles and the address
 * question (onboarding-facts, 2026-11-10).
 *
 * ── APPROVED WORD FOR WORD by Xander, 2026-11-10 ("Approve as drafted") ─────
 * The copy deck (mockup https://claude.ai/artifact/K9iQcYFjUkaPp1fFRoLJMd): "First draft" page
 * items #3 to #55, and "Simpler (v2)" page items #56 to #67, which replace #4 to #7, #10 to #17 and
 * #30 to #42, with the build notes listed there (#35 shortened, #50 dropped, singulars, the phone
 * "Next service"). Change none of these without his approval. Each string carries its deck number.
 * Items #1 and #2 (timings) were approved the same day and live in screens.tsx and model.ts.
 *
 * The page headings quoted in the "Adds …" lines ("What's included", "Signs it's time to call",
 * "What to expect", "Starting at", "Common questions", "Brands we work with", "Areas we serve")
 * were approved on 2026-11-10 for the service page itself (service-page-spec.md §3).
 *
 * ── PHOTOS, APPROVED WORD FOR WORD by Xander, 2026-11-11 ("Approve as drafted") ─────
 * Mockup https://claude.ai/artifact/P1VQn1Ry22JgnkdXEVAfQ5, items P1 to P7 and S1 to S4. P5, P6,
 * S2 and S4 were kept as they were. Each string carries its item id.
 */

import type { ProfileKind } from "@jdd/schema";

export const C = {
    // Contact (#3): the screen is otherwise the approved three fields.
    addressNote: "Used to find your local area.", // #3

    // Do customers come to you? (#56 to #59)
    // Show your address? (A1 to A5, Xander 2026-11-12, approved word for word, mockup
    // https://claude.ai/artifact/1jN9RQefsjuVy5sx65ZPVA; replace #56 to #59.) Same data: yes shows
    // the full address, no hides the street (serviceAreaBusiness).
    visitNav: "Your address", // A1
    visitQ: "Show your address on your site?", // A2
    visitHelp: "If customers don't come to you, we can show just your town.", // A3
    visitYes: "Yes, show my address", // A4
    visitYesDetail: "Your full address shows on your site.", // A4
    visitNo: "No, keep it off", // A5
    visitNoDetail: "We'll show your town instead of your street address.", // A5

    // Towns (#8, #9)
    townsCount: (n: number) => `${n} added, up to 20`, // #8
    townsCap: "Up to 20 towns. That's Google's limit too.", // #9

    // Google listing (#56, #60, #61)
    googleNav: "Google listing", // #56
    googleQ: "Are you on Google Maps?", // #60
    googleHelp: "Your Google Business Profile is the most important link on your site. It's how people find you on the map.", // #60
    googleLabel: "Your Google Maps link", // #61
    googleSteps: ["Open Google Maps and find your business", "Tap Share", "Copy the link and paste it here"], // #61
    pasteLink: "Paste the link", // #16

    // Other profiles (#56, #62)
    elsewhereNav: "Other profiles", // #56
    elsewhereQ: "Where else can customers find you?", // #62
    elsewhereHelp: "Tap any you have, then paste the link. Skip the rest.", // #62
    linkLabel: (site: string) => `${site} link`, // #62
    anotherLink: "Another link", // #62 (chip and field label for any other profile)

    // Link checks (#18, #53)
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

    // One service, step by step (#63 to #67, plus the question words #32 to #38 and #48 to #51)
    stepOf: (service: string, i: number, n: number) => `${service} · ${i} of ${n}`, // #63
    doneWithService: "Done with this service", // #63
    next: "Next", // #63
    skip: "Skip", // #63
    adds: (heading: string) => `Adds "${heading}" to this service's page.`, // #64
    adds2: (a: string, b: string) => `Adds "${a}" and "${b}" to this service's page.`, // #64
    addsPhotos: "Adds your photos to this service's page.", // #64
    qIncluded: "What's included?", // #32
    hIncluded: "Tap what's part of the job, or add your own.", // #33
    qJobs: "What do customers call you about?", // #32
    hJobs: "The problems that bring people to you, in their words. These are what they type into Google.", // #34
    qPriceTime: "Price and timing", // #65
    hPriceTime: "Both are optional. We only show what you tell us.", // #65
    qPrice: "Starting price", // #32
    hPrice: 'Shown as "Starting at $X" on this service.', // #35 (shortened for v2)
    qDuration: "How long does it usually take?", // #48 (Xander's words)
    durationChips: ["Under an hour", "Half a day", "A full day", "A few days"], // #49 (Xander's words)
    addDuration: "Something else, like 2 to 3 hours", // #51
    qQuestions: "What do customers ask about this?", // #32
    hQuestions: "Tap the questions you hear. Add a short answer in your own words if you like. We only use what you tell us.", // #36
    qPhotos: "Photos of you doing this work", // S1 (2026-11-11; was #32 "Photos of this job")
    hPhotos: "Up to 3. The first one becomes this service's picture across your site. The rest show on its page.", // #37
    photosCap: "Up to 3 photos per service.", // #37
    listCap: (n: number) => `Up to ${n} for each service.`, // #37
    qBrands: "Brands you use for this", // #32
    hBrands: "Tap any that apply. They're added to your Brands list too.", // #38
    qAreas: "Where do you do this?", // #32
    areasAll: "Everywhere I cover", // #39
    areasSome: "Only some towns", // #39
    addIncluded: "Something else that's included?", // #42
    addJobs: "Something else they call about?", // #42
    addQuestion: "Another question customers ask?", // #42
    answerPh: "Your answer, in a few words", // #42

    // A service's last step (#66, #67)
    doneReady: (service: string) => `${service} is ready for its own page`, // #66
    doneSaved: (service: string) => `${service} is saved`, // #66
    doneNotYet: "One more detail and it gets its own page. You can come back to it any time before you send.", // #66
    nextServiceNamed: (name: string) => `Next service: ${name}`, // #66
    nextServiceShort: "Next service", // #66 (phones, where the name doesn't fit)
    backToAll: "Back to all services", // #66
    dIncluded: (n: number) => (n === 1 ? "1 thing included" : `${n} things included`), // #67
    dJobs: (n: number) => (n === 1 ? "1 job customers call about" : `${n} jobs customers call about`), // #67
    dQuestions: (n: number) => (n === 1 ? "1 question customers ask" : `${n} questions customers ask`), // #67
    dPhotos: (n: number) => (n === 1 ? "1 photo" : `${n} photos`), // #67
    dNoPhotos: "No photos yet", // #67

    // Wireframe labels (#43 to #45, #54, #55)
    capPages: "Your pages so far", // #43
    capService: "Wireframe of this service's page", // #43
    capServicePhone: "This service's page, not the final design", // #43
    pgOwn: "its own page", // #44
    pgNear: "1 more detail", // #44
    pgCore: "needs what's included", // #44
    pgAll: (m: number) => `all ${m} services`, // #44
    ghostJobs: '+ "Signs it\'s time to call": add what customers call you about', // #45
    ghostExpect: '+ "What to expect": add how long it usually takes', // #55
    ghostPrice: '+ "Starting at": add a starting price', // #45
    ghostQuestions: '+ "Common questions": add what customers ask', // #45
    ghostAreas: '+ "Areas we serve": only if it\'s some of your towns', // #45
    ghostPhotos: "+ Photos of you doing this work", // S3 (2026-11-11; was #45 "+ Photos of this job")
    // The general Photos step and every photo box (P1 to P4, P7)
    photosQ: "Do you have photos of your completed work or your business?", // P1
    photosHelp: "Finished jobs, your trucks, your shop, your team at work. Add what you have.", // P2
    photosLabel: "Your photos", // P3
    // P3 as first approved. Xander, 2026-11-11, "Yes, when it ships": every general photo now goes at
    // the top of the homepage (the hero carousel), so the interim "The first one goes…" line is retired.
    photosLabelNote: "Up to 10. These go at the top of your homepage.", // P3
    dropHint: "Drag photos here or tap to choose", // P4
    dropLimits: "PNG, JPG or WebP, up to 10 MB each.", // P4
    workCap: "Up to 10 photos.", // P3's limit, shown when a drop holds more photos than fit
    welcomePhotos: "Your logo and some photos of your work or your business. No logo or photos yet? That's fine, we'll sort it.", // P7

    // The tagline question (T2 to T6), approved word for word by Xander, 2026-11-11 ("Approve as
    // drafted", mockup https://claude.ai/artifact/BaoLxNU2Gd9JPLhh4yW3CA). T6 is the first of the
    // two skip lines drafted.
    taglineNav: "Tagline", // T2
    taglineQ: "Do you have a tagline?", // T3
    taglineHelp: "A few words that sit under your business name at the top and bottom of your site.", // T4
    taglineExample: (sample: string) => `e.g. ${sample}`, // T5 (sample: the trade template's tagline)
    taglineSkip: "No tagline? Skip this. We'll suggest one for you to approve.", // T6

    profilesPlaceholder: "Google · Facebook · Yelp", // #54

    // Local SEO questions (Xander, 2026-11-12). Q2 and Q5 are approved word for word in
    // local-seo-architecture-decisions.md; the Q2 rail label "Top towns" was approved word for word
    // the same day, after the screenshots.
    topTownsNav: "Top towns", // Q2 rail label, approved 2026-11-12
    topTownsQ: "Which towns do you get the most work from?", // Q2
    topTownsHelp: "Pick up to 3. We'll start with these.", // Q2
    qPriceFactors: "What makes this job cost more or less?", // Q5
    hPriceFactors: "No prices needed. For example the size of the home, or how hard it is to reach.", // Q5
    photoTownQ: "Which town was this job in?", // Q1
    photoTownHelp: "Town only, never the street.", // Q1
    notSure: "Not sure", // Q1, the last chip
} as const;

/** Short site names for the "Other profiles" chips (#62), the reviews chips (#20) and #18. */
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

/** The "how to" half of the wrong-site line (#18, #53), per kind. */
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
