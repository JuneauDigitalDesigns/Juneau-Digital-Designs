/**
 * Turns the onboarding wizard's POST body into a `BrandIntakeSubmission`, field by field.
 *
 * Lifted out of `app/api/portal/onboarding/route.ts` so it can be tested without a request. The
 * route used to rebuild the submission inline and simply never copied nine answers the wizard
 * collected (owner's name, brands carried, response time, and the whole "Proof & details" set:
 * stats, review aggregate, starting prices, seasons, travel radius, current offer). The build then
 * flagged them as missing as if the client had left them blank. Every field of
 * `BrandIntakeSubmission` is handled here now, and `test/onboarding-submission.test.mjs` pins it.
 *
 * Everything is sanitized and length-capped; nothing is defaulted that the client didn't give.
 */

import { PROFILE_KINDS, type BrandIntakeSubmission, type Intake, type PalettePick, type ProfileKind, type ServiceEntry } from "@jdd/schema";
import { isValidBlobUrl } from "./blob-url";
import { normaliseProfileLink } from "./profile-links";

type PlanSlug = "starter" | "growth" | "enterprise";
type Body = Partial<Record<string, unknown>>;

const MAX_FIELD = 2000;
/** Matches the wizard's own cap. The route used to keep only 8 while the wizard allowed 12. */
export const MAX_SERVICES = 12;

function sanitize(value: unknown, limit = MAX_FIELD): string {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, limit);
}

function sanitizeStringArray(value: unknown, maxItems: number, itemLimit: number): string[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, maxItems).map((v) => sanitize(v, itemLimit)).filter(Boolean);
}

function sanitizeFilename(value: unknown): string {
    if (typeof value !== "string") return "";
    const base = value.replace(/\\/g, "/").split("/").pop() ?? "";
    return base.replace(/\.\./g, "").replace(/\0/g, "").trim().slice(0, 200);
}

function sanitizeImageMeta(item: unknown): { url: string; filename: string; alt: string } | null {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    const url = sanitize(obj.url, 500);
    if (!url || !isValidBlobUrl(url)) return null;
    return { url, filename: sanitizeFilename(obj.filename), alt: sanitize(obj.alt, 200) };
}

const BG_MOODS = ["white", "warm", "cool", "soft-dark", "deep-dark"] as const;
const PALETTE_SLOTS = ["accent", "accentFg", "bg", "bgSoft", "ink", "inkSoft", "rule"] as const;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeOverrides(raw: unknown): PalettePick["overrides"] {
    if (!raw || typeof raw !== "object") return undefined;
    const obj = raw as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const slot of PALETTE_SLOTS) {
        const v = obj[slot];
        if (typeof v === "string" && HEX_RE.test(v.trim())) out[slot] = v.trim().toUpperCase();
    }
    return Object.keys(out).length ? out : undefined;
}

function sanitizePalette(raw: unknown): PalettePick {
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const overrides = sanitizeOverrides(obj.overrides);
    if (sanitize(obj.mode, 10) !== "custom") {
        return { mode: "preset", presetId: sanitize(obj.presetId, 60), overrides };
    }
    const mood = sanitize(obj.bgMood, 20);
    return {
        mode: "custom",
        presetId: sanitize(obj.presetId, 60),
        baseColor: sanitize(obj.baseColor, 20),
        accentColor: sanitize(obj.accentColor, 20),
        bgMood: (BG_MOODS as readonly string[]).includes(mood) ? (mood as PalettePick["bgMood"]) : undefined,
        overrides,
    };
}

/** What one service's page shows at most; the wizard caps to the same numbers. */
const SERVICE_CAPS = { included: 8, typicalJobs: 6, brands: 8, questions: 5, photos: 3 } as const;

function sanitizeQuestions(raw: unknown, max: number): { q: string; a: string }[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((x) => {
            const o = (x ?? {}) as Record<string, unknown>;
            return { q: sanitize(o.q, 140), a: sanitize(o.a, 300) };
        })
        .filter((x) => x.q)
        .slice(0, max);
}

/**
 * A service with its optional page facts (v1.32.0). Every list is trimmed, de-blanked and capped
 * to what the service page shows; photos must be our own blob URLs. Blank facts are left out, so
 * the mapper flags them in `_meta.missing_fields` rather than storing empties.
 */
function sanitizeService(raw: unknown, withFacts: boolean): ServiceEntry {
    const o = (raw ?? {}) as Record<string, unknown>;
    const entry: ServiceEntry = { name: sanitize(o.name, 120), tag: sanitize(o.tag, 80) };
    if (!withFacts) return entry;
    const included = sanitizeStringArray(o.included, 40, 80).slice(0, SERVICE_CAPS.included);
    const typicalJobs = sanitizeStringArray(o.typicalJobs, 40, 80).slice(0, SERVICE_CAPS.typicalJobs);
    const areas = sanitizeStringArray(o.areas, 20, 80);
    const brands = sanitizeStringArray(o.brands, 40, 80).slice(0, SERVICE_CAPS.brands);
    const priceFrom = sanitize(o.priceFrom, 40);
    const duration = sanitize(o.duration, 40);
    const photos = (Array.isArray(o.photos) ? o.photos : [])
        .map(sanitizeImageMeta)
        .filter((x): x is { url: string; filename: string; alt: string } => x !== null)
        .slice(0, SERVICE_CAPS.photos);
    const questions = sanitizeQuestions(o.questions, SERVICE_CAPS.questions);
    return {
        ...entry,
        ...(included.length ? { included } : {}),
        ...(typicalJobs.length ? { typicalJobs } : {}),
        ...(areas.length ? { areas } : {}),
        ...(brands.length ? { brands } : {}),
        ...(priceFrom ? { priceFrom } : {}),
        ...(duration ? { duration } : {}),
        ...(photos.length ? { photos } : {}),
        ...(questions.length ? { questions } : {}),
    };
}

function sanitizeServiceList(raw: unknown, withFacts = true): ServiceEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .slice(0, MAX_SERVICES)
        .map((s) => sanitizeService(s, withFacts))
        .filter((s) => s.name);
}

/** Profile links: a known kind, a link on the right site, not a search page, one per kind. */
function sanitizeProfiles(raw: unknown): { kind: ProfileKind; url: string }[] {
    if (!Array.isArray(raw)) return [];
    const kinds = new Set<string>(PROFILE_KINDS);
    const out: { kind: ProfileKind; url: string }[] = [];
    for (const item of raw.slice(0, 16)) {
        const o = (item ?? {}) as Record<string, unknown>;
        const kind = sanitize(o.kind, 20);
        if (!kinds.has(kind) || out.some((p) => p.kind === kind)) continue;
        const url = normaliseProfileLink(kind as ProfileKind, sanitize(o.url, 500));
        if (url) out.push({ kind: kind as ProfileKind, url });
    }
    return out;
}

/** `{key, value, label}` stat entries; blank values dropped (the mapper drops them too). */
function sanitizeStats(raw: unknown): { key: string; value: string; label: string }[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .slice(0, 8)
        .map((s) => {
            const o = (s ?? {}) as Record<string, unknown>;
            return { key: sanitize(o.key, 40), value: sanitize(o.value, 60), label: sanitize(o.label, 60) };
        })
        .filter((s) => s.key && s.value);
}

function sanitizeReviewAggregate(raw: unknown): BrandIntakeSubmission["reviewAggregate"] {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const score = sanitize(o.score, 10);
    const count = sanitize(o.count, 12);
    if (!score && !count) return null;
    const url = sanitize(o.url, 500);
    return { score, count, ...(url && /^https?:\/\//i.test(url) ? { url } : {}) };
}

function sanitizeRecord(raw: unknown, maxKeys: number, keyLimit: number, valueLimit: number): Record<string, string> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>)
            .slice(0, maxKeys)
            .map(([k, v]) => [sanitize(k, keyLimit), sanitize(v, valueLimit)] as const)
            .filter(([k, v]) => k && v),
    );
}

function sanitizeSeasons(raw: unknown): { key: string; label: string; body: string }[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .slice(0, 6)
        .map((s) => {
            const o = (s ?? {}) as Record<string, unknown>;
            return { key: sanitize(o.key, 20), label: sanitize(o.label, 40), body: sanitize(o.body, 400) };
        })
        .filter((s) => s.key && s.body);
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type SubmissionResult =
    | { ok: true; submission: BrandIntakeSubmission }
    | { ok: false; reason: "invalid-email" | "declined-not-starter" };

/**
 * Build the submission from the POST body and the site it is for.
 *
 * `site.plan` is the fallback plan and `site.signerEmail` the fallback email, as before.
 */
export function buildSubmission(body: Body, site: { plan: PlanSlug; signerEmail?: string }): SubmissionResult {
    const validPlans: PlanSlug[] = ["starter", "growth", "enterprise"];
    const rawPlan = sanitize(body.selectedPlan, 20);
    const selectedPlan: PlanSlug = validPlans.includes(rawPlan as PlanSlug) ? (rawPlan as PlanSlug) : site.plan;

    /**
     * The activation choice, narrowed against the three valid values. Anything unrecognised is
     * `undefined` ("not asked") rather than coerced: provisioning refuses to run without a stated
     * choice, so a bad value stalls a build and gets noticed instead of buying, or withholding, a
     * phone number. Website-only off Starter is refused outright: onboard.js rejects it too, and
     * catching it here means the client hears about it instead of the build stalling later.
     */
    const rawReceptionist = sanitize(body.receptionistMode, 20);
    const receptionistMode =
        rawReceptionist === "forwarded" || rawReceptionist === "published" || rawReceptionist === "declined"
            ? rawReceptionist
            : undefined;
    if (receptionistMode === "declined" && selectedPlan !== "starter") return { ok: false, reason: "declined-not-starter" };

    const email = sanitize(body.email, 160) || site.signerEmail || "";
    if (email && !isValidEmail(email)) return { ok: false, reason: "invalid-email" };

    const bd = body.brandDirection && typeof body.brandDirection === "object" ? (body.brandDirection as Record<string, unknown>) : {};
    const rawImages = body.images && typeof body.images === "object" ? (body.images as Record<string, unknown>) : {};
    const heroSlides = Array.isArray(rawImages.heroSlides)
        ? rawImages.heroSlides.slice(0, 10).map(sanitizeImageMeta).filter((x): x is { url: string; filename: string; alt: string } => x !== null)
        : [];
    const logo = rawImages.logo ? sanitizeImageMeta(rawImages.logo) ?? undefined : undefined;
    const aboutFeature = rawImages.aboutFeature ? sanitizeImageMeta(rawImages.aboutFeature) ?? undefined : undefined;

    const additionalSites = Array.isArray(body.additionalSites)
        ? body.additionalSites
              .slice(0, 2)
              .map((s) => {
                  const o = s as Record<string, unknown>;
                  const sbd = o.brandDirection && typeof o.brandDirection === "object" ? (o.brandDirection as Record<string, unknown>) : {};
                  return {
                      brandName: sanitize(o.brandName, 160),
                      brandShort: sanitize(o.brandShort, 80),
                      email: sanitize(o.email, 160),
                      phone: sanitize(o.phone, 60),
                      address: sanitize(o.address, 300),
                      businessHours: sanitize(o.businessHours, 300),
                      serviceList: sanitizeServiceList(o.serviceList, false),
                      palette: sanitizePalette(o.palette),
                      brandDirection: {
                          differentiators: sanitize(sbd.differentiators, 800),
                          targetCustomer: "",
                          vibe: [],
                          tone: [],
                          adjectives: [],
                          references: "",
                          forbidden: "",
                      },
                  };
              })
              .filter((s) => s.brandName)
        : [];

    const serviceRadiusMiles = sanitize(body.serviceRadiusMiles, 20);
    const offerBadge = sanitize(body.offerBadge, 120);
    const profiles = sanitizeProfiles(body.profiles);
    const customerQuestions = sanitizeQuestions(body.customerQuestions, 10);

    const submission: BrandIntakeSubmission = {
        selectedPlan,
        ...(receptionistMode ? { receptionistMode } : {}),
        brandName: sanitize(body.brandName, 160),
        brandShort: sanitize(body.brandShort, 80),
        email,
        phone: sanitize(body.phone, 60),
        address: sanitize(body.address, 300),
        license: sanitize(body.license, 200),
        industry: sanitize(body.industry, 120),
        established: sanitize(body.established, 40),
        ownerName: sanitize(body.ownerName, 120),
        brandsCarried: sanitize(body.brandsCarried, 600),
        responseTime: sanitize(body.responseTime, 120),
        notableClients: sanitize(body.notableClients, 500),
        certifications: sanitize(body.certifications, 600),
        businessHours: sanitize(body.businessHours, 300),
        serviceArea: sanitize(body.serviceArea, 400),
        agentName: sanitize(body.agentName, 80),
        serviceList: sanitizeServiceList(body.serviceList),
        brandDirection: {
            differentiators: sanitize(bd.differentiators, 800),
            targetCustomer: sanitize(bd.targetCustomer, 300),
            vibe: sanitizeStringArray(bd.vibe, 12, 40),
            tone: sanitizeStringArray(bd.tone, 12, 40),
            adjectives: sanitizeStringArray(bd.adjectives, 12, 40),
            references: sanitize(bd.references, 500),
            forbidden: sanitize(bd.forbidden, 500),
        },
        palette: sanitizePalette(body.palette),
        hasLogo: Boolean(body.hasLogo),
        images: { logo, heroSlides, aboutFeature },
        existingWebsiteUrl: sanitize(body.existingWebsiteUrl, 500),
        announcement: sanitize(body.announcement, 300),
        stats: sanitizeStats(body.stats),
        reviewAggregate: sanitizeReviewAggregate(body.reviewAggregate),
        servicePrices: sanitizeRecord(body.servicePrices, MAX_SERVICES, 120, 40),
        seasons: sanitizeSeasons(body.seasons),
        ...(serviceRadiusMiles ? { serviceRadiusMiles } : {}),
        ...(offerBadge ? { offerBadge } : {}),
        // v1.32.0. Only a real boolean is an answer; anything else stays "not asked".
        ...(typeof body.serviceAreaBusiness === "boolean" ? { serviceAreaBusiness: body.serviceAreaBusiness } : {}),
        ...(profiles.length ? { profiles } : {}),
        ...(customerQuestions.length ? { customerQuestions } : {}),
        additionalSites: selectedPlan === "enterprise" ? additionalSites : undefined,
    };
    return { ok: true, submission };
}

/**
 * Record on every site that the client did not choose the palette.
 *
 * The wizard no longer asks for colors: JDD picks them in the console's Brand drawer. The intake
 * still carries the trade's default preset because onboard.js requires `brand.palette`, so this
 * puts `brand.palette` on `_meta.missing_fields`, the list the console already shows as "the
 * intake didn't supply this". No schema change; the console can build a sharper flag on it later.
 */
export function markPaletteNotClientChosen(intake: Intake): Intake {
    return {
        ...intake,
        sites: intake.sites.map((site) => {
            const missing = site._meta.missing_fields ?? [];
            return missing.includes("brand.palette")
                ? site
                : { ...site, _meta: { ...site._meta, missing_fields: [...missing, "brand.palette"] } };
        }),
    };
}
