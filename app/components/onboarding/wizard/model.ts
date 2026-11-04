/**
 * The onboarding wizard's model: what it asks, in what order, what blocks, and what it sends.
 *
 * Pure on purpose. Everything a test needs to pin (the screen order for a trade and plan, which
 * screens block, what each answer becomes in the submission, how an old draft is read back) lives
 * here with no React and no browser, so `test/onboarding-model.test.mjs` can exercise it directly.
 *
 * ── What the client is never asked ──────────────────────────────────────────
 *
 * - Colors. JDD chooses the palette in the console's Brand drawer. The submission still carries
 *   the trade's default preset because onboard.js requires `brand.palette`, and the route marks it
 *   as not client-supplied (`brand.palette` in `_meta.missing_fields`).
 * - EIN, representative, A2P industry. The operator collects those in the console.
 * - Anything we can work out from an answer already given. Years in business comes from the year
 *   started, towns covered from the towns list, the rating stat from the rating and count, and 24/7
 *   availability from the hours. These are computed from the client's own facts, never invented;
 *   a blank source leaves the stat out.
 */

import {
    DEFAULT_PALETTE_PRESET_ID,
    INDUSTRY_MENUS,
    OTHER_INDUSTRY,
    customersFor,
    differentiatorsFor,
    joinChoices,
    menuFor,
    palettesForVertical,
    type BrandIntakeSubmission,
    type ImageMeta,
    type ServiceEntry,
    type TemplateSlots,
} from "@jdd/schema";

export type PlanSlug = "starter" | "growth" | "enterprise";
export type ReceptionistMode = "forwarded" | "published" | "declined";

/** One Enterprise additional site. Colors are not asked here either. */
export type AdditionalSiteForm = {
    brandName: string;
    brandShort: string;
    email: string;
    phone: string;
    address: string;
    differentiators: string;
};

/** The wizard's answers. Persisted as the draft (`v: 2`). */
export type WizardState = {
    v: 2;
    /** The screen the client is on, by id, so a resumed draft opens exactly where they left. */
    screen: string;
    /** Screens the client has reached. The rail only lets them jump to these. */
    visited: string[];
    /** Optional screens the client chose "Skip for now" on. Listed on Review as still to come. */
    skipped: string[];

    trade: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    towns: string[];
    website: string;

    services: ServiceEntry[];
    diffs: string[];
    customers: string[];

    established: string;
    license: string;
    owner: string;
    response: string;
    brands: string[];
    certs: string[];
    rating: string;
    reviewCount: string;
    reviewUrl: string;
    /** Stat answers the trade's template asks for that can't be worked out (keyed by stat key). */
    statValues: Record<string, string>;
    servicePrices: Record<string, string>;
    seasonBodies: Record<string, string>;
    serviceRadiusMiles: string;
    offerBadge: string;

    /** "design" = "Not yet. Design one for me." An uploaded logo lives in `images.logo`. */
    logoChoice: "" | "design";
    images: { logo?: ImageMeta; heroSlides: ImageMeta[]; aboutFeature?: ImageMeta };
    voice: string[];
    avoid: string;

    receptionistMode: ReceptionistMode | "";
    /** One of HOURS_PRESETS, or CUSTOM_HOURS with the text in `customHours`. */
    hours: string;
    customHours: string;
    emergency: boolean;
    agentName: string;

    additionalSites: AdditionalSiteForm[];
};

export type WizardContext = {
    plan: PlanSlug;
    /** The phone choice made at signing, if any. Locks the website-only boundary. */
    signedMode?: ReceptionistMode;
};

export const MAX_SERVICES = 12;
export const MAX_VOICES = 3;
export const MAX_WORK_PHOTOS = 10;

export const HOURS_PRESETS = ["Mon to Fri, 8am to 5pm", "Mon to Sat, 7am to 6pm", "Open 24/7"] as const;
export const CUSTOM_HOURS = "custom";
export const EMERGENCY_LINE = "Emergency calls answered 24/7";

/** Suggestions only; every list also takes the client's own entries. */
export const BRAND_SUGGESTIONS: Record<string, string[]> = {
    hvac: ["Carrier", "Trane", "Lennox", "Rheem", "Goodman", "Daikin", "Mitsubishi", "Bryant"],
    plumbing: ["Rheem", "Bradford White", "A.O. Smith", "Navien", "Rinnai", "Kohler", "Moen"],
    roofing: ["GAF", "Owens Corning", "CertainTeed", "TAMKO", "Malarkey"],
    "car-detailing": ["Ceramic Pro", "Gtechniq", "XPEL", "3M"],
};
export const CERT_SUGGESTIONS: Record<string, string[]> = {
    hvac: ["NATE certified", "EPA 608", "BBB accredited", "ENERGY STAR partner", "Manufacturer authorized dealer"],
    plumbing: ["Master plumber", "Backflow certified", "BBB accredited"],
    roofing: ["GAF Certified Contractor", "Owens Corning Preferred Contractor", "BBB accredited"],
    "lawn-care": ["Licensed pesticide applicator", "BBB accredited"],
    "car-detailing": ["IDA certified", "Ceramic Pro certified installer", "XPEL certified installer"],
};

/** Stat keys worked out from other answers rather than asked. */
const DERIVED_STATS = new Set(["yearsTrading", "coverageTowns", "rating", "emergencyAvailability", "availability"]);

export const CHAPTERS = [
    { label: "Your business", mins: "1 min" },
    { label: "Your work", mins: "1 min" },
    { label: "The specifics", mins: "2 min" },
    { label: "Your look", mins: "2 min" },
    { label: "Your phone", mins: "1 min" },
] as const;

/**
 * Where an answer shows up on the wireframe, so the current question can outline it.
 * `none` means the screen doesn't fill a visible part of the site.
 */
export type WireFocus = "brand" | "contact" | "towns" | "website" | "services" | "pillars" | "hero" | "stats" | "trust" | "photos" | "call" | "hours" | "none";

export type ScreenDef = {
    id: string;
    /** -1 for welcome and review, which sit outside the chapters. */
    chapter: number;
    /** Short name for the rail. */
    nav: string;
    required?: boolean;
    skippable?: boolean;
    focus: WireFocus;
};

const S = (id: string, chapter: number, nav: string, focus: WireFocus, extra: Partial<ScreenDef> = {}): ScreenDef => ({ id, chapter, nav, focus, ...extra });

/** The slots a trade's bespoke template asks for beyond the generic questions, if any. */
export function slotsFor(trade: string): TemplateSlots | undefined {
    return menuFor(trade)?.templateSlots;
}

/** Stats this trade's template shows that we can't work out from another answer. */
export function askedStats(trade: string, state?: Pick<WizardState, "hours" | "emergency">): TemplateSlots["stats"] {
    const slots = slotsFor(trade);
    if (!slots) return [];
    return slots.stats.filter((s) => {
        // Plumbing's "availability" is only derivable when the client is 24/7; otherwise ask.
        if (s.key === "availability") return !(state && isAround247(state));
        return !DERIVED_STATS.has(s.key);
    });
}

/**
 * The screens for this client, in order. Depends on the trade (which template questions apply,
 * whether a brands screen makes sense) and the plan (Enterprise gets the extra-sites screen).
 */
export function screensFor(state: Pick<WizardState, "trade" | "hours" | "emergency" | "services">, ctx: WizardContext): ScreenDef[] {
    const slots = slotsFor(state.trade);
    const out: ScreenDef[] = [
        S("welcome", -1, "Welcome", "none"),
        S("trade", 0, "Your trade", "brand", { required: true }),
        S("name", 0, "Business name", "brand", { required: true }),
        S("contact", 0, "Contact details", "contact", { required: true }),
        S("area", 0, "Towns", "towns", { skippable: true }),
        S("website", 0, "Website", "website", { skippable: true }),
        ...(ctx.plan === "enterprise" ? [S("sites", 0, "Other locations", "none", { skippable: true })] : []),
        S("services", 1, "Services", "services", { skippable: true }),
        S("apart", 1, "What sets you apart", "pillars", { skippable: true }),
        S("customers", 1, "Who you serve", "hero", { skippable: true }),
        S("since", 2, "Year and license", "stats", { skippable: true }),
        S("people", 2, "Owner and response", "trust", { skippable: true }),
        ...(BRAND_SUGGESTIONS[state.trade] ? [S("brands", 2, "Brands", "trust", { skippable: true })] : []),
        S("certs", 2, "Certifications", "trust", { skippable: true }),
        S("reviews", 2, "Reviews", "stats", { skippable: true }),
        ...(askedStats(state.trade, state).length ? [S("numbers", 2, "A few numbers", "stats", { skippable: true })] : []),
        // Prices are asked per service, so the screen only makes sense once there are services.
        ...(slots?.priceFrom && state.services.length ? [S("prices", 2, "Starting prices", "services", { skippable: true })] : []),
        ...(slots?.seasons?.length ? [S("seasons", 2, "Seasonal programs", "services", { skippable: true })] : []),
        ...(slots?.serviceRadius ? [S("radius", 2, "Travel radius", "towns", { skippable: true })] : []),
        ...(slots?.offerBadge ? [S("offer", 2, "Current offer", "hero", { skippable: true })] : []),
        S("logo", 3, "Logo", "brand"),
        S("photos", 3, "Photos", "photos", { skippable: true }),
        S("voice", 3, "Voice", "hero", { skippable: true }),
        S("setup", 4, "Phone setup", "call", { required: true }),
        S("hours", 4, "Hours", "hours", { skippable: true }),
        S("review", -1, "Review", "none"),
    ];
    return out;
}

// ── Checks ───────────────────────────────────────────────────────────────────

const digits = (s: string) => (s || "").replace(/\D/g, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The receptionist options this client may pick: website-only is Starter only (onboard.js rejects it elsewhere). */
export function modesFor(ctx: WizardContext): ReceptionistMode[] {
    // The signed choice sets the website-only boundary; crossing it is a terms change, not an edit.
    if (ctx.signedMode === "declined") return ["declined"];
    if (ctx.signedMode) return ["forwarded", "published"];
    return ctx.plan === "starter" ? ["forwarded", "published", "declined"] : ["forwarded", "published"];
}

/**
 * Errors for a screen, keyed by field. Empty means the client may continue. Only the four
 * facts the build cannot run without, and the phone choice, ever block.
 */
export function screenErrors(id: string, state: WizardState, ctx: WizardContext): Record<string, string> {
    const e: Record<string, string> = {};
    if (id === "trade" && !state.trade) e.trade = 'Pick the closest one. "Something else" is fine too.';
    if (id === "name" && !state.name.trim()) e.name = "We need your business name to build your site.";
    if (id === "contact") {
        const d = digits(state.phone);
        if (!d) e.phone = "We need a phone number to set up your calls.";
        else if (d.length < 10) e.phone = "That looks short. Try the full number, like (407) 555-0142.";
        if (!EMAIL_RE.test(state.email.trim())) e.email = "That email doesn't look complete.";
        if (!state.address.trim()) e.address = "We need an address for your site and your local area.";
    }
    if (id === "setup" && (!state.receptionistMode || !modesFor(ctx).includes(state.receptionistMode))) {
        e.receptionistMode = "Pick one so we know whether to set up a number.";
    }
    return e;
}

/** Required screens that still have errors, in order. Send stays off until this is empty. */
export function requiredGaps(state: WizardState, ctx: WizardContext): ScreenDef[] {
    return screensFor(state, ctx).filter((s) => s.required && Object.keys(screenErrors(s.id, state, ctx)).length > 0);
}

/** Whether a screen has any answer in it (drives the rail ticks and Review's "Still to come"). */
export function isAnswered(id: string, state: WizardState): boolean {
    switch (id) {
        case "trade": return !!state.trade;
        case "name": return !!state.name.trim();
        case "contact": return !!(state.phone.trim() && state.address.trim());
        case "area": return state.towns.length > 0;
        case "website": return !!state.website.trim();
        case "sites": return state.additionalSites.some((s) => s.brandName.trim());
        case "services": return state.services.length > 0;
        case "apart": return state.diffs.length > 0;
        case "customers": return state.customers.length > 0;
        case "since": return !!(state.established.trim() || state.license.trim());
        case "people": return !!(state.owner.trim() || state.response.trim());
        case "brands": return state.brands.length > 0;
        case "certs": return state.certs.length > 0;
        case "reviews": return !!(state.rating.trim() || state.reviewCount.trim() || state.reviewUrl.trim());
        case "numbers": return Object.values(state.statValues).some((v) => v.trim());
        case "prices": return Object.values(state.servicePrices).some((v) => v.trim());
        case "seasons": return Object.values(state.seasonBodies).some((v) => v.trim());
        case "radius": return !!state.serviceRadiusMiles.trim();
        case "offer": return !!state.offerBadge.trim();
        case "logo": return !!state.images.logo || state.logoChoice === "design";
        case "photos": return state.images.heroSlides.length > 0 || !!state.images.aboutFeature;
        case "voice": return state.voice.length > 0;
        case "setup": return !!state.receptionistMode;
        case "hours": return !!(state.hours && (state.hours !== CUSTOM_HOURS || state.customHours.trim())) || !!state.agentName.trim();
        default: return true;
    }
}

// ── Derived values ───────────────────────────────────────────────────────────

/** Years in business from the year started, or null when it isn't a plausible year. */
export function yearsInBusiness(established: string, now: Date = new Date()): number | null {
    const y = parseInt((established || "").trim(), 10);
    const thisYear = now.getFullYear();
    if (!Number.isFinite(y) || y < 1900 || y > thisYear) return null;
    return thisYear - y;
}

export function isAround247(state: Pick<WizardState, "hours" | "emergency">): boolean {
    return state.emergency || state.hours === "Open 24/7";
}

/** The town the address names (the part before the state), offered as the first town. */
export function townFromAddress(address: string): string {
    const parts = (address || "").split(",").map((p) => p.trim()).filter(Boolean);
    return parts.length >= 2 ? cleanEntry(parts[parts.length - 2]) : "";
}

/**
 * Clean a chip the client typed. The mapper splits list fields on commas, semicolons and line
 * breaks, so an entry containing one would arrive as two; those characters become spaces.
 */
export function cleanEntry(raw: string): string {
    return (raw || "").replace(/[,;\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** The text the site's hours line gets, or "" when the client gave none. */
export function hoursLine(state: Pick<WizardState, "hours" | "customHours" | "emergency">): string {
    const base = state.hours === CUSTOM_HOURS ? state.customHours.trim() : state.hours;
    const parts = [base, state.emergency && state.hours !== "Open 24/7" ? EMERGENCY_LINE : ""].filter(Boolean);
    return parts.join(". ");
}

/**
 * Stat values for this trade's template: worked out where the answer already exists, otherwise
 * what the client typed on "A few numbers". A blank source leaves the stat out entirely.
 */
export function statValuesFor(state: WizardState, now: Date = new Date()): Record<string, string> {
    const slots = slotsFor(state.trade);
    if (!slots) return {};
    const out: Record<string, string> = {};
    for (const s of slots.stats) {
        let v = "";
        if (s.key === "yearsTrading") {
            const y = yearsInBusiness(state.established, now);
            v = y && y > 0 ? `${y}+` : "";
        } else if (s.key === "coverageTowns") {
            v = state.towns.length ? String(state.towns.length) : "";
        } else if (s.key === "rating") {
            v = state.rating.trim() && state.reviewCount.trim() ? `${state.rating.trim()}★ from ${state.reviewCount.trim()} reviews` : "";
        } else if (s.key === "emergencyAvailability" || (s.key === "availability" && isAround247(state))) {
            v = isAround247(state) ? "24/7" : "";
        } else {
            v = (state.statValues[s.key] ?? "").trim();
        }
        if (v) out[s.key] = v;
    }
    return out;
}

/**
 * Short caption for each stat tile. Presentational chrome for the built site, never a fact about
 * the business; carried over from the previous wizard's STAT_LABELS.
 */
export const STAT_LABELS: Record<string, string> = {
    emergencyAvailability: "Emergency line",
    yearsTrading: "Years in business",
    rating: "Average rating",
    coverageTowns: "Towns covered",
    roofsReplaced: "Roofs replaced",
    warrantyYears: "Workmanship warranty",
    typicalJobDays: "Typical job time",
    availability: "Availability",
    avgArrivalTime: "Avg. arrival time",
    yearsLicensed: "Years licensed",
    lawnsServicedWeekly: "Lawns serviced weekly",
    neighbourhoods: "Routes covered",
    vehiclesDetailed: "Vehicles detailed",
    coatingDurability: "Coating durability",
    mobileCoverage: "Mobile coverage",
};

/** The palette the build starts from. The client never chooses; JDD sets the real one in the console. */
export function defaultPaletteId(trade: string): string {
    return palettesForVertical(trade)[0]?.id ?? DEFAULT_PALETTE_PRESET_ID;
}

export function servicesMenu(trade: string) {
    return menuFor(trade)?.services ?? [];
}
export const diffOptions = (trade: string) => differentiatorsFor(trade);
export const customerOptions = (trade: string) => customersFor(trade);
export const TRADE_OPTIONS: { id: string; label: string }[] = [
    ...INDUSTRY_MENUS.map((m) => ({ id: m.id as string, label: m.label })),
    { id: OTHER_INDUSTRY, label: "Something else" },
];

// ── Submission ───────────────────────────────────────────────────────────────

const list = (xs: string[]) => xs.map(cleanEntry).filter(Boolean).join("\n");

/**
 * What the wizard sends. Same `BrandIntakeSubmission` shape the route and jdd-ops read today;
 * only the way it is gathered changed. Blank answers stay blank (or absent) so the mapper flags
 * them in `_meta.missing_fields`; nothing here is invented.
 */
export function buildPayload(state: WizardState, ctx: WizardContext, now: Date = new Date()): BrandIntakeSubmission {
    const slots = slotsFor(state.trade);
    const stats = statValuesFor(state, now);
    const priced = slots?.priceFrom ? state.servicePrices : {};
    return {
        selectedPlan: ctx.plan,
        ...(state.receptionistMode ? { receptionistMode: state.receptionistMode } : {}),
        brandName: state.name.trim(),
        email: state.email.trim(),
        phone: state.phone.trim(),
        address: state.address.trim(),
        industry: state.trade,
        established: state.established.trim(),
        license: state.license.trim(),
        ownerName: state.owner.trim(),
        responseTime: state.response.trim(),
        serviceArea: list(state.towns),
        brandsCarried: list(state.brands),
        certifications: list(state.certs),
        businessHours: hoursLine(state),
        agentName: state.agentName.trim(),
        serviceList: state.services
            .map((s) => ({ name: cleanEntry(s.name), tag: s.tag }))
            .filter((s) => s.name)
            .slice(0, MAX_SERVICES),
        brandDirection: {
            differentiators: joinChoices(state.diffs.map(cleanEntry).filter(Boolean)),
            targetCustomer: joinChoices(state.customers.map(cleanEntry).filter(Boolean)),
            vibe: [],
            tone: state.voice.slice(0, MAX_VOICES),
            adjectives: [],
            references: "",
            forbidden: state.avoid.trim(),
        },
        palette: { mode: "preset", presetId: defaultPaletteId(state.trade) },
        hasLogo: !!state.images.logo,
        images: state.images,
        existingWebsiteUrl: state.website.trim(),
        stats: Object.entries(stats).map(([key, value]) => ({ key, value, label: STAT_LABELS[key] ?? key })),
        reviewAggregate:
            state.rating.trim() || state.reviewCount.trim()
                ? { score: state.rating.trim(), count: state.reviewCount.trim(), url: state.reviewUrl.trim() || undefined }
                : null,
        servicePrices: Object.fromEntries(Object.entries(priced).filter(([name, v]) => v.trim() && state.services.some((s) => s.name === name)).map(([k, v]) => [k, v.trim()])),
        seasons: (slots?.seasons ?? [])
            .filter((s) => (state.seasonBodies[s.key] ?? "").trim())
            .map((s) => ({ key: s.key, label: s.label, body: state.seasonBodies[s.key].trim() })),
        serviceRadiusMiles: slots?.serviceRadius ? state.serviceRadiusMiles.trim() || undefined : undefined,
        offerBadge: slots?.offerBadge ? state.offerBadge.trim() || undefined : undefined,
        additionalSites:
            ctx.plan === "enterprise"
                ? state.additionalSites
                      .filter((s) => s.brandName.trim())
                      .map((s) => ({
                          brandName: s.brandName.trim(),
                          brandShort: s.brandShort.trim(),
                          email: s.email.trim(),
                          phone: s.phone.trim(),
                          address: s.address.trim(),
                          businessHours: "",
                          serviceList: [],
                          palette: { mode: "preset", presetId: defaultPaletteId(state.trade) },
                          brandDirection: { differentiators: s.differentiators.trim(), targetCustomer: "", vibe: [], tone: [], adjectives: [], references: "", forbidden: "" },
                      }))
                : undefined,
    };
}

// ── Drafts ───────────────────────────────────────────────────────────────────

export function initialState(email: string, signedMode?: ReceptionistMode): WizardState {
    return {
        v: 2, screen: "welcome", visited: ["welcome"], skipped: [],
        trade: "", name: "", phone: "", email, address: "", towns: [], website: "",
        services: [], diffs: [], customers: [],
        established: "", license: "", owner: "", response: "", brands: [], certs: [],
        rating: "", reviewCount: "", reviewUrl: "", statValues: {}, servicePrices: {}, seasonBodies: {}, serviceRadiusMiles: "", offerBadge: "",
        logoChoice: "", images: { heroSlides: [] }, voice: [], avoid: "",
        receptionistMode: signedMode ?? "", hours: "", customHours: "", emergency: false, agentName: "",
        additionalSites: [],
    };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const rec = (v: unknown): Record<string, string> =>
    v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "string") as [string, string][]) : {};
const splitText = (v: unknown) => str(v).split(/[,;\n]/).map(cleanEntry).filter(Boolean);

/**
 * Read a saved draft back, from either shape.
 *
 * Drafts live for 30 days in localStorage and Redis, so clients mid-form when this wizard ships
 * have the previous wizard's shape (`currentStep` index, `industry`, `serviceArea` as text, chip
 * and free-text pairs). Those answers are carried over rather than dropped; the client resumes at
 * the first screen of the new flow with everything they had typed already filled in.
 */
export function restoreDraft(raw: unknown, base: WizardState): WizardState {
    if (!raw || typeof raw !== "object") return base;
    const d = raw as Record<string, unknown>;
    const images = d.images && typeof d.images === "object" ? (d.images as WizardState["images"]) : base.images;
    const safeImages: WizardState["images"] = {
        ...(images.logo ? { logo: images.logo } : {}),
        heroSlides: Array.isArray(images.heroSlides) ? images.heroSlides.slice(0, MAX_WORK_PHOTOS) : [],
        ...(images.aboutFeature ? { aboutFeature: images.aboutFeature } : {}),
    };
    const services = Array.isArray(d.services ?? d.serviceList)
        ? ((d.services ?? d.serviceList) as unknown[])
              .map((s) => ({ name: cleanEntry(str((s as ServiceEntry)?.name)), tag: str((s as ServiceEntry)?.tag) }))
              .filter((s) => s.name)
              .slice(0, MAX_SERVICES)
        : [];
    const mode = str(d.receptionistMode);
    const receptionistMode: WizardState["receptionistMode"] =
        // The signed choice wins over a stale draft: it is a term of the agreement.
        base.receptionistMode || (mode === "forwarded" || mode === "published" || mode === "declined" ? mode : "");
    const sites = Array.isArray(d.additionalSites)
        ? (d.additionalSites as Record<string, unknown>[]).map((s) => ({
              brandName: str(s?.brandName), brandShort: str(s?.brandShort), email: str(s?.email),
              phone: str(s?.phone), address: str(s?.address), differentiators: str(s?.differentiators),
          }))
        : [];

    if (d.v === 2) {
        const screen = str(d.screen) || base.screen;
        return {
            ...base,
            screen,
            visited: strs(d.visited).length ? strs(d.visited) : [screen],
            skipped: strs(d.skipped),
            trade: str(d.trade), name: str(d.name), phone: str(d.phone), email: str(d.email) || base.email,
            address: str(d.address), towns: strs(d.towns).map(cleanEntry).filter(Boolean), website: str(d.website),
            services, diffs: strs(d.diffs), customers: strs(d.customers),
            established: str(d.established), license: str(d.license), owner: str(d.owner), response: str(d.response),
            brands: strs(d.brands), certs: strs(d.certs),
            rating: str(d.rating), reviewCount: str(d.reviewCount), reviewUrl: str(d.reviewUrl),
            statValues: rec(d.statValues), servicePrices: rec(d.servicePrices), seasonBodies: rec(d.seasonBodies),
            serviceRadiusMiles: str(d.serviceRadiusMiles), offerBadge: str(d.offerBadge),
            logoChoice: d.logoChoice === "design" ? "design" : "",
            images: safeImages, voice: strs(d.voice).slice(0, MAX_VOICES), avoid: str(d.avoid),
            receptionistMode, hours: str(d.hours), customHours: str(d.customHours), emergency: d.emergency === true,
            agentName: str(d.agentName), additionalSites: sites,
        };
    }

    // The previous wizard's shape.
    const diffText = cleanEntry(str(d.diffText));
    const customerText = cleanEntry(str(d.customerText));
    const anything = !!(str(d.industry) || str(d.brandName) || str(d.phone));
    return {
        ...base,
        screen: anything ? "trade" : base.screen,
        visited: anything ? ["welcome", "trade"] : base.visited,
        trade: str(d.industry), name: str(d.brandName), phone: str(d.phone), email: str(d.email) || base.email,
        address: str(d.address), towns: splitText(d.serviceArea), website: str(d.existingWebsiteUrl),
        services,
        diffs: [...strs(d.diffChips), ...(diffText ? [diffText] : [])],
        customers: [...strs(d.customerChips), ...(customerText ? [customerText] : [])],
        established: str(d.established), license: str(d.license), owner: str(d.ownerName), response: str(d.responseTime),
        brands: splitText(d.brandsCarried),
        rating: str(d.reviewScore), reviewCount: str(d.reviewCount), reviewUrl: str(d.reviewUrl),
        statValues: rec(d.statValues), servicePrices: rec(d.servicePrices), seasonBodies: rec(d.seasonBodies),
        serviceRadiusMiles: str(d.serviceRadiusMiles), offerBadge: str(d.offerBadge),
        images: safeImages, voice: strs(d.voice).slice(0, MAX_VOICES), avoid: str(d.forbidden),
        receptionistMode, additionalSites: sites,
    };
}
