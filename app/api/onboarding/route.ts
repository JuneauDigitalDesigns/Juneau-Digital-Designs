import { NextResponse } from "next/server";
import { mapPayloadToIntake, type OnboardingSubmission, type AdditionalSiteEntry } from "@/app/lib/site-schema";

const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;
const makeWebhookUrl = process.env.MAKE_INTAKE_WEBHOOK_URL;

/** Deep-clone replacing every empty string with null. Empty arrays/objects pass through. */
function normalizeEmpties(value: unknown): unknown {
    if (value === "") return null;
    if (Array.isArray(value)) return value.map(normalizeEmpties);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeEmpties(v)]),
        );
    }
    return value;
}

type PlanSlug = "starter" | "growth" | "enterprise";

type ImageMeta = {
    url?: string;
    filename?: string;
    alt?: string;
};

type ServiceEntry = {
    t?: string;
    tag?: string;
    d?: string;
    images?: ImageMeta[];
};

type TestimonialEntry = {
    q?: string;
    a?: string;
    r?: string;
    company?: string;
    stars?: string;
    avatar?: ImageMeta;
};

type HeroBullet = {
    value?: string;
    label?: string;
};

type FaqEntry = {
    q?: string;
    a?: string;
};

type Pillar = {
    k?: string;
    t?: string;
    d?: string;
};

type AboutStat = {
    n?: string;
    l?: string;
};

type Project = {
    t?: string;
    loc?: string;
    yr?: string;
    scope?: string;
    size?: string;
    caption?: string;
    image?: ImageMeta;
};

type OnboardingPayload = {
    brandName?: string;
    brandLong?: string;
    brandShort?: string;
    email?: string;
    phone?: string;
    address?: string;
    license?: string;
    websiteType?: string;
    industry?: string;
    established?: string;
    brandTagline?: string;
    usp?: string;
    notableClients?: string;
    businessHours?: string;
    certifications?: string;
    awards?: string;
    paletteAccent?: string;
    paletteBg?: string;
    paletteBgSoft?: string;
    paletteInk?: string;
    paletteInkSoft?: string;
    paletteRule?: string;
    hasLogo?: string;
    announcement?: string;
    seoTitle?: string;
    seoDescription?: string;
    seoCanonical?: string;
    googleAnalyticsId?: string;
    facebookPixelId?: string;
    mapsUrl?: string;
    bookingUrl?: string;
    portalUrl?: string;
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
    heroEyebrow?: string;
    heroHeadline?: string;
    heroHeadlineEmphasis?: string;
    heroSub?: string;
    heroCta?: string;
    heroSecondaryCta?: string;
    heroBadge?: string;
    heroFrictionReducers?: string[];
    heroBullets?: HeroBullet[];
    aboutEyebrow?: string;
    aboutTitle?: string;
    aboutBody?: string;
    servicesEyebrow?: string;
    servicesTitle?: string;
    servicesSub?: string;
    services?: ServiceEntry[];
    workEyebrow?: string;
    workTitle?: string;
    workSub?: string;
    testimonialsEyebrow?: string;
    testimonialsTitle?: string;
    testimonials?: TestimonialEntry[];
    faqEyebrow?: string;
    faqTitle?: string;
    faqSub?: string;
    faqs?: FaqEntry[];
    pillars?: Pillar[];
    aboutStats?: AboutStat[];
    projects?: Project[];
    finalCtaEyebrow?: string;
    finalCtaHeadline?: string;
    finalCtaSub?: string;
    finalCtaCta?: string;
    finalCtaSecondary?: string;
    finalCtaFrictionReducers?: string[];
    footerBlurb?: string;
    footerLegal?: string;
    images?: {
        heroSlides?: ImageMeta[];
        logo?: ImageMeta;
        aboutFeature?: ImageMeta;
    };
    selectedPlan?: string;
    consent?: boolean;
    turnstileToken?: string;
    website?: string;
    additionalSites?: AdditionalSiteRaw[];
    formMode?: string;
    scrapeExistingWebsite?: boolean;
    scrapeWebsiteDomain?: string;
};

type AdditionalSiteRaw = {
    brandName?: string;
    brandShort?: string;
    brandTagline?: string;
    email?: string;
    phone?: string;
    address?: string;
    paletteAccent?: string;
    paletteBg?: string;
    paletteBgSoft?: string;
    paletteInk?: string;
    paletteInkSoft?: string;
    paletteRule?: string;
    heroHeadline?: string;
    heroSub?: string;
    businessHours?: string;
    usp?: string;
    services?: ServiceEntry[];
    faqs?: FaqEntry[];
};

type TurnstileVerifyResponse = {
    success: boolean;
    "error-codes"?: string[];
};

const maxFieldLength = 2000;

function sanitize(value: unknown, limit = maxFieldLength): string {
    if (typeof value !== "string") {
        return "";
    }
    return value.trim().slice(0, limit);
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Accepts only https URLs hosted on the Vercel public Blob CDN. */
function isValidBlobUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            parsed.protocol === "https:" &&
            parsed.hostname.endsWith(".public.blob.vercel-storage.com")
        );
    } catch {
        return false;
    }
}

/** Strips path traversal sequences and returns the basename only. */
function sanitizeFilename(value: unknown): string {
    if (typeof value !== "string") return "";
    const base = value.replace(/\\/g, "/").split("/").pop() ?? "";
    return base.replace(/\.\./g, "").replace(/\0/g, "").trim().slice(0, 200);
}

/** Sanitizes and validates a single ImageMeta object. Returns null if the URL is invalid. */
function sanitizeImageMeta(
    item: unknown
): { url: string; filename: string; alt: string } | null {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    const url = sanitize(obj.url, 500);
    if (!url || !isValidBlobUrl(url)) return null;
    return {
        url,
        filename: sanitizeFilename(obj.filename),
        alt: sanitize(obj.alt, 200),
    };
}

async function verifyTurnstileToken(token: string, remoteIp: string): Promise<boolean> {
    if (!turnstileSecretKey) {
        return false;
    }

    const payload = new URLSearchParams({
        secret: turnstileSecretKey,
        response: token,
    });

    if (remoteIp) {
        payload.set("remoteip", remoteIp);
    }

    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload,
    });

    if (!verifyResponse.ok) {
        return false;
    }

    const verifyResult = (await verifyResponse.json()) as TurnstileVerifyResponse;
    if (!verifyResult.success) {
        console.error("[onboarding] Turnstile verification failed:", verifyResult["error-codes"]);
    }
    return Boolean(verifyResult.success);
}

/**
 * Fire-and-log POST to Make.com. Returns true on 2xx, false otherwise.
 * Never throws — webhook failures must not block the form response.
 */
async function postToMakeWebhook(body: unknown): Promise<boolean> {
    if (!makeWebhookUrl) {
        console.warn("[onboarding] MAKE_INTAKE_WEBHOOK_URL not set — skipping webhook");
        return false;
    }
    try {
        const res = await fetch(makeWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "<unreadable>");
            console.error(`[onboarding] Make webhook returned ${res.status}: ${text.slice(0, 200)}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error("[onboarding] Make webhook fetch failed:", err);
        return false;
    }
}

export async function POST(request: Request) {
    try {
        if (!turnstileSecretKey || !makeWebhookUrl) {
            return NextResponse.json(
                { message: "Server is not configured for onboarding submissions yet." },
                { status: 500 }
            );
        }

        const body = (await request.json()) as OnboardingPayload;

        // Honeypot
        const honeypot = sanitize(body.website, 120);
        if (honeypot) {
            return NextResponse.json({ message: "Submission accepted." }, { status: 200 });
        }

        const turnstileToken = sanitize(body.turnstileToken, 4000);
        if (!turnstileToken) {
            return NextResponse.json(
                { message: "Please complete security verification before submitting." },
                { status: 400 }
            );
        }

        const forwardedFor = request.headers.get("x-forwarded-for") || "";
        const remoteIp = forwardedFor.split(",")[0]?.trim() || "";
        const isTurnstileValid = await verifyTurnstileToken(turnstileToken, remoteIp);
        if (!isTurnstileValid) {
            return NextResponse.json(
                { message: "Security verification failed. Please try again." },
                { status: 400 }
            );
        }

        // Sanitize scalar fields
        const brandName = sanitize(body.brandName, 160);
        const brandLong = sanitize(body.brandLong, 160);
        const brandShort = sanitize(body.brandShort, 80);
        const email = sanitize(body.email, 160);
        const phone = sanitize(body.phone, 60);
        const address = sanitize(body.address, 300);
        const license = sanitize(body.license, 200);
        const websiteType = sanitize(body.websiteType, 120);
        const industry = sanitize(body.industry, 120);
        const established = sanitize(body.established, 20);
        const brandTagline = sanitize(body.brandTagline, 300);
        const usp = sanitize(body.usp, 500);
        const notableClients = sanitize(body.notableClients, 500);
        const businessHours = sanitize(body.businessHours, 300);
        const certifications = sanitize(body.certifications, 300);
        const awards = sanitize(body.awards, 300);
        const paletteAccent = sanitize(body.paletteAccent, 20);
        const paletteBg = sanitize(body.paletteBg, 20);
        const paletteBgSoft = sanitize(body.paletteBgSoft, 20);
        const paletteInk = sanitize(body.paletteInk, 20);
        const paletteInkSoft = sanitize(body.paletteInkSoft, 20);
        const paletteRule = sanitize(body.paletteRule, 20);
        const hasLogo = sanitize(body.hasLogo, 10);
        const announcement = sanitize(body.announcement, 300);
        const seoTitle = sanitize(body.seoTitle, 200);
        const seoDescription = sanitize(body.seoDescription, 500);
        const seoCanonical = sanitize(body.seoCanonical, 200);
        const googleAnalyticsId = sanitize(body.googleAnalyticsId, 60);
        const facebookPixelId = sanitize(body.facebookPixelId, 60);
        const mapsUrl = sanitize(body.mapsUrl, 500);
        const bookingUrl = sanitize(body.bookingUrl, 500);
        const portalUrl = sanitize(body.portalUrl, 500);
        const linkedin = sanitize(body.linkedin, 300);
        const instagram = sanitize(body.instagram, 300);
        const facebook = sanitize(body.facebook, 300);
        const youtube = sanitize(body.youtube, 300);
        const heroEyebrow = sanitize(body.heroEyebrow, 120);
        const heroHeadline = sanitize(body.heroHeadline, 300);
        const heroHeadlineEmphasis = sanitize(body.heroHeadlineEmphasis, 200);
        const heroSub = sanitize(body.heroSub, 500);
        const heroCta = sanitize(body.heroCta, 120);
        const heroSecondaryCta = sanitize(body.heroSecondaryCta, 120);
        const heroBadge = sanitize(body.heroBadge, 200);
        const aboutEyebrow = sanitize(body.aboutEyebrow, 120);
        const aboutTitle = sanitize(body.aboutTitle, 200);
        const aboutBody = sanitize(body.aboutBody, 3000);
        const servicesEyebrow = sanitize(body.servicesEyebrow, 120);
        const servicesTitle = sanitize(body.servicesTitle, 200);
        const servicesSub = sanitize(body.servicesSub, 300);
        const workEyebrow = sanitize(body.workEyebrow, 120);
        const workTitle = sanitize(body.workTitle, 200);
        const workSub = sanitize(body.workSub, 300);
        const testimonialsEyebrow = sanitize(body.testimonialsEyebrow, 120);
        const testimonialsTitle = sanitize(body.testimonialsTitle, 200);
        const faqEyebrow = sanitize(body.faqEyebrow, 120);
        const faqTitle = sanitize(body.faqTitle, 200);
        const faqSub = sanitize(body.faqSub, 300);
        const finalCtaEyebrow = sanitize(body.finalCtaEyebrow, 120);
        const finalCtaHeadline = sanitize(body.finalCtaHeadline, 300);
        const finalCtaSub = sanitize(body.finalCtaSub, 500);
        const finalCtaCta = sanitize(body.finalCtaCta, 120);
        const finalCtaSecondary = sanitize(body.finalCtaSecondary, 120);
        const footerBlurb = sanitize(body.footerBlurb, 500);
        const footerLegal = sanitize(body.footerLegal, 300);
        const consent = Boolean(body.consent);

        const rawFormMode = sanitize(body.formMode, 20);
        const formMode: "basic" | "detailed" = rawFormMode === "basic" ? "basic" : "detailed";
        const scrapeExistingWebsite = Boolean(body.scrapeExistingWebsite);
        const scrapeWebsiteDomain = sanitize(body.scrapeWebsiteDomain, 500);

        const validPlans: PlanSlug[] = ["starter", "growth", "enterprise"];
        const rawPlan = sanitize(body.selectedPlan, 20);
        const selectedPlan: PlanSlug = validPlans.includes(rawPlan as PlanSlug)
            ? (rawPlan as PlanSlug)
            : "starter";

        // Sanitize dynamic arrays
        const services = Array.isArray(body.services)
            ? body.services.slice(0, 6).map((s) => {
                  const rawImages = Array.isArray(s?.images) ? s.images : [];
                  const images = rawImages
                      .slice(0, 5)
                      .map(sanitizeImageMeta)
                      .filter((x): x is { url: string; filename: string; alt: string } => x !== null);
                  return {
                      t: sanitize(s?.t, 120),
                      tag: sanitize(s?.tag, 80),
                      d: sanitize(s?.d, 500),
                      images,
                  };
              })
            : [];

        const testimonials = Array.isArray(body.testimonials)
            ? body.testimonials.slice(0, 3).map((t) => ({
                  q: sanitize(t?.q, 1000),
                  a: sanitize(t?.a, 120),
                  r: sanitize(t?.r, 120),
                  company: sanitize(t?.company, 120),
                  stars: Math.min(5, Math.max(1, parseInt(sanitize(t?.stars, 2)) || 5)),
              }))
            : [];

        const heroBullets = Array.isArray(body.heroBullets)
            ? body.heroBullets.slice(0, 4).map((s) => ({
                  value: sanitize(s?.value, 80),
                  label: sanitize(s?.label, 120),
              }))
            : [];

        const faqs = Array.isArray(body.faqs)
            ? body.faqs.slice(0, 6).map((f) => ({
                  q: sanitize(f?.q, 300),
                  a: sanitize(f?.a, 1000),
              }))
            : [];

        const heroFrictionReducers = Array.isArray(body.heroFrictionReducers)
            ? body.heroFrictionReducers.slice(0, 4).map((s) => sanitize(s, 200))
            : [];

        const finalCtaFrictionReducers = Array.isArray(body.finalCtaFrictionReducers)
            ? body.finalCtaFrictionReducers.slice(0, 4).map((s) => sanitize(s, 200))
            : [];

        const pillars = Array.isArray(body.pillars)
            ? body.pillars.slice(0, 4).map((p) => ({
                  k: sanitize(p?.k, 80),
                  t: sanitize(p?.t, 120),
                  d: sanitize(p?.d, 300),
              }))
            : [];

        const aboutStats = Array.isArray(body.aboutStats)
            ? body.aboutStats.slice(0, 4).map((s) => ({
                  n: sanitize(s?.n, 40),
                  l: sanitize(s?.l, 120),
              }))
            : [];

        const projects = Array.isArray(body.projects)
            ? body.projects.slice(0, 6).map((p) => ({
                  t: sanitize(p?.t, 160),
                  loc: sanitize(p?.loc, 120),
                  yr: sanitize(p?.yr, 10),
                  scope: sanitize(p?.scope, 120),
                  size: sanitize(p?.size, 80),
                  caption: sanitize(p?.caption, 300),
                  image: p?.image ? (sanitizeImageMeta(p.image) ?? undefined) : undefined,
              }))
            : [];

        // Sanitize additionalSites (Enterprise tier; up to 2 extra sites for a 3-site cluster max)
        const additionalSites: AdditionalSiteEntry[] = Array.isArray(body.additionalSites)
            ? body.additionalSites.slice(0, 2).map((s) => {
                  const sites = Array.isArray(s?.services)
                      ? s!.services!.slice(0, 6).map((x) => {
                            const rawImgs = Array.isArray(x?.images) ? x!.images! : [];
                            const images = rawImgs
                                .slice(0, 5)
                                .map(sanitizeImageMeta)
                                .filter((y): y is { url: string; filename: string; alt: string } => y !== null);
                            return {
                                t: sanitize(x?.t, 120),
                                tag: sanitize(x?.tag, 80),
                                d: sanitize(x?.d, 500),
                                images,
                            };
                        })
                      : [];
                  const faqsArr = Array.isArray(s?.faqs)
                      ? s!.faqs!.slice(0, 6).map((f) => ({
                            q: sanitize(f?.q, 300),
                            a: sanitize(f?.a, 1000),
                        }))
                      : [];
                  return {
                      brandName: sanitize(s?.brandName, 160),
                      brandShort: sanitize(s?.brandShort, 80),
                      brandTagline: sanitize(s?.brandTagline, 300),
                      email: sanitize(s?.email, 160),
                      phone: sanitize(s?.phone, 60),
                      address: sanitize(s?.address, 300),
                      paletteAccent: sanitize(s?.paletteAccent, 20),
                      paletteBg: sanitize(s?.paletteBg, 20),
                      paletteBgSoft: sanitize(s?.paletteBgSoft, 20),
                      paletteInk: sanitize(s?.paletteInk, 20),
                      paletteInkSoft: sanitize(s?.paletteInkSoft, 20),
                      paletteRule: sanitize(s?.paletteRule, 20),
                      heroHeadline: sanitize(s?.heroHeadline, 300),
                      heroSub: sanitize(s?.heroSub, 500),
                      businessHours: sanitize(s?.businessHours, 300),
                      usp: sanitize(s?.usp, 500),
                      services: sites,
                      faqs: faqsArr,
                  };
              }).filter((s) => s.brandName)
            : [];

        // Required field validation
        if (!brandName || !email || !phone || !websiteType) {
            return NextResponse.json(
                { message: "Please complete all required fields." },
                { status: 400 }
            );
        }

        if (!isValidEmail(email)) {
            return NextResponse.json(
                { message: "Please provide a valid email address." },
                { status: 400 }
            );
        }

        if (!consent) {
            return NextResponse.json(
                { message: "Privacy consent is required before submission." },
                { status: 400 }
            );
        }

        // Sanitize and validate image uploads
        const rawImages = body.images && typeof body.images === "object" ? body.images : {};

        const heroSlides = Array.isArray(rawImages.heroSlides)
            ? rawImages.heroSlides
                  .slice(0, 10)
                  .map(sanitizeImageMeta)
                  .filter((x): x is { url: string; filename: string; alt: string } => x !== null)
            : [];

        const logo = rawImages.logo ? (sanitizeImageMeta(rawImages.logo) ?? undefined) : undefined;
        const aboutFeature = rawImages.aboutFeature ? (sanitizeImageMeta(rawImages.aboutFeature) ?? undefined) : undefined;

        // Assemble structured data object
        const submissionData = {
            selectedPlan,
            contact: { brandName, brandLong, brandShort, email, phone, address, license, websiteType },
            businessDetails: { industry, established, brandTagline, usp, notableClients, certifications, awards, businessHours },
            branding: { paletteAccent, paletteBg, paletteBgSoft, paletteInk, paletteInkSoft, paletteRule, hasLogo },
            announcement,
            seo: { seoTitle, seoDescription, seoCanonical, googleAnalyticsId, facebookPixelId },
            extensions: { mapsUrl, bookingUrl, portalUrl },
            socialMedia: { linkedin, instagram, facebook, youtube },
            hero: { heroEyebrow, heroHeadline, heroHeadlineEmphasis, heroSub, heroCta, heroSecondaryCta, heroBadge, heroFrictionReducers },
            about: { aboutEyebrow, aboutTitle, aboutBody, pillars, stats: aboutStats },
            servicesSection: { servicesEyebrow, servicesTitle, servicesSub },
            work: { workEyebrow, workTitle, workSub, projects },
            testimonialsMeta: { testimonialsEyebrow, testimonialsTitle },
            faqMeta: { faqEyebrow, faqTitle, faqSub },
            finalCta: { finalCtaEyebrow, finalCtaHeadline, finalCtaSub, finalCtaCta, finalCtaSecondary, finalCtaFrictionReducers },
            footer: { footerBlurb, footerLegal },
            images: { heroSlides, logo, aboutFeature },
            services,
            testimonials,
            heroBullets,
            faqs,
            additionalSites,
            formMode,
            scrapeExistingWebsite,
            scrapeWebsiteDomain,
        };

        // Map to Intake envelope ({ plan, siteCount, sites: SiteContent[] }) and POST to Make.com.
        const intake = mapPayloadToIntake(submissionData as OnboardingSubmission);
        const webhookPayload = {
            ...intake,
            _payload_json: JSON.stringify(normalizeEmpties(intake), null, 2),
        };
        const webhookOk = await postToMakeWebhook(webhookPayload);
        if (!webhookOk) {
            return NextResponse.json(
                { message: "There was a problem submitting your request. Please try again." },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: "Onboarding submission sent successfully." }, { status: 200 });
    } catch {
        return NextResponse.json(
            { message: "Unexpected server error while processing your submission." },
            { status: 500 }
        );
    }
}
