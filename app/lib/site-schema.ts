/**
 * site-schema.ts — wire format between juneau-digital-designs/onboarding and
 * jdd-ops/onboard.js (the per-client Next.js template's src/data/site.ts).
 *
 * The SiteContent type below MUST stay in sync with:
 *   business-site-template/src/data/site.ts → exports SiteContent
 *
 * Single source of truth: the template. This file is the over-the-wire mirror.
 */

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface NavItem {
    label: string;
    href: string;
}

export interface FooterLink {
    label: string;
    href: string;
}

export interface Pillar {
    k: string;
    t: string;
    d: string;
}

export interface Stat {
    n: string;
    l: string;
}

export interface ServiceItem {
    n: string;
    t: string;
    d: string;
    tag: string;
    image?: { url: string; alt: string } | null;
}

export interface Project {
    t: string;
    loc: string;
    yr: string | null;
    scope: string;
    size: string;
    caption: string;
    image?: { url: string; alt: string } | null;
}

export interface Testimonial {
    q: string;
    a: string;
    r: string;
    company: string | null;
    stars: number;
}

export interface FaqItem {
    q: string;
    a: string;
}

export interface FooterCol {
    h: string;
    links: FooterLink[];
}

export interface HeroContent {
    eyebrow: string;
    headline: string;
    headlineEmphasis: string | null;
    sub: string;
    formLabel: string;
    placeholder: string;
    cta: string;
    secondaryCta: string;
    trust: string;
    badge: string | null;
    frictionReducers: string[];
    heroBullets: Array<{ value: string; label: string }>;
    rotatingImages: Array<{ caption: string; tone: "light" | "mid" | "dark" | "ink" }>;
}

export interface AboutContent {
    eyebrow: string;
    title: string;
    body: string;
    pillars: Pillar[];
    stats: Stat[];
}

export interface ServicesContent {
    eyebrow: string;
    title: string;
    sub: string;
    items: ServiceItem[];
}

export interface WorkContent {
    eyebrow: string;
    title: string;
    sub: string;
    projects: Project[];
    hidden: boolean;
}

export interface TestimonialsContent {
    eyebrow: string;
    title: string;
    items: Testimonial[];
}

export interface FaqContent {
    eyebrow: string;
    title: string;
    sub: string;
    items: FaqItem[];
}

export interface FinalCtaContent {
    eyebrow: string;
    headline: string;
    sub: string;
    cta: string;
    secondary: string | null;
    frictionReducers: string[];
}

export interface FooterContent {
    blurb: string;
    cols: FooterCol[];
    social: FooterLink[];
    legalLinks: FooterLink[];
    legal: string;
}

export interface BrandPalette {
    accent: string;
    accentFg?: string;
    bg: string;
    bgSoft: string;
    ink: string;
    inkSoft: string;
    rule: string;
}

export interface BrandTypography {
    fontSans: string;
    fontHeading: string;
    fontMono?: string;
    headingWeight: number;
    bodyWeight: number;
    headingTracking?: string;
    headingLineHeight?: number;
}

export interface BrandContent {
    name: string;
    short: string;
    long: string;
    established: string | null;
    tagline: string;
    phone: string;
    phoneHref: string;
    email: string;
    address: string;
    license: string | null;
    palette: BrandPalette;
    typography: BrandTypography;
}

export interface SeoContent {
    title: string;
    description: string;
    canonical: string;
    googleAnalyticsId: string | null;
    facebookPixelId: string | null;
}

export interface ExtensionsContent {
    trustBadges: string[] | null;
    reviewBadge: { rating: number; count: number; url: string } | null;
    contactDetails: { address: string; mapsUrl: string | null } | null;
    hours: Record<string, string> | null;
    bookingUrl: string | null;
    portalUrl: string | null;
    socialMedia: {
        linkedin: string | null;
        instagram: string | null;
        facebook: string | null;
        youtube: string | null;
    } | null;
}

export interface SiteImages {
    hero: { portrait?: string; slides?: Array<{ url: string; alt: string }> };
    about: { feature?: string };
    work: { cards: string[] };
    testimonials: { avatars?: string[] };
    footer: { logoImage?: string };
}

export interface ContentMeta {
    schema_version: string;
    generated_at: string;
    variation: "D";
    is_placeholder: boolean;
    missing_fields: string[];
    selectedPlan: "starter" | "growth" | "enterprise";
    siteIndex?: number;       // 1-based; set for Enterprise sites only
    siteCount?: number;       // total cluster size; set for Enterprise sites only
    siblingSlugs?: string[];  // other slug names in the same Enterprise cluster
}

export interface SiteContent {
    brand: BrandContent;
    nav: NavItem[];
    announcement: string | null;
    trust: { label: string; logos: string[] };
    hero: HeroContent;
    about: AboutContent;
    services: ServicesContent;
    work: WorkContent;
    testimonials: TestimonialsContent;
    faq: FaqContent;
    finalCta: FinalCtaContent;
    footer: FooterContent;
    seo: SeoContent;
    extensions: ExtensionsContent;
    images: SiteImages;
    _meta: ContentMeta;
}

// ─── Payload shape (what the onboarding form posts) ───────────────────────────

export type ImageMeta = { url: string; filename: string; alt: string };

export interface OnboardingSubmission {
    selectedPlan: "starter" | "growth" | "enterprise";
    contact: {
        brandName: string;
        brandLong: string;
        brandShort: string;
        email: string;
        phone: string;
        address: string;
        license: string;
        websiteType: string;
    };
    businessDetails: {
        industry: string;
        established: string;
        brandTagline: string;
        usp: string;
        notableClients: string;
        certifications: string;
        awards: string;
        businessHours: string;
    };
    branding: {
        paletteAccent: string;
        paletteBg: string;
        paletteBgSoft: string;
        paletteInk: string;
        paletteInkSoft: string;
        paletteRule: string;
        hasLogo: string;
    };
    announcement: string;
    seo: {
        seoTitle: string;
        seoDescription: string;
        seoCanonical: string;
        googleAnalyticsId: string;
        facebookPixelId: string;
    };
    extensions: { mapsUrl: string; bookingUrl: string; portalUrl: string };
    socialMedia: { linkedin: string; instagram: string; facebook: string; youtube: string };
    hero: {
        heroEyebrow: string;
        heroHeadline: string;
        heroHeadlineEmphasis: string;
        heroSub: string;
        heroCta: string;
        heroSecondaryCta: string;
        heroBadge: string;
        heroFrictionReducers: string[];
    };
    about: {
        aboutEyebrow: string;
        aboutTitle: string;
        aboutBody: string;
        pillars: Array<{ k: string; t: string; d: string }>;
        stats: Array<{ n: string; l: string }>;
    };
    servicesSection: { servicesEyebrow: string; servicesTitle: string; servicesSub: string };
    work: {
        workEyebrow: string;
        workTitle: string;
        workSub: string;
        projects: Array<{
            t: string;
            loc: string;
            yr: string;
            scope: string;
            size: string;
            caption: string;
            image?: ImageMeta;
        }>;
    };
    testimonialsMeta: { testimonialsEyebrow: string; testimonialsTitle: string };
    faqMeta: { faqEyebrow: string; faqTitle: string; faqSub: string };
    finalCta: {
        finalCtaEyebrow: string;
        finalCtaHeadline: string;
        finalCtaSub: string;
        finalCtaCta: string;
        finalCtaSecondary: string;
        finalCtaFrictionReducers: string[];
    };
    footer: { footerBlurb: string; footerLegal: string };
    images: { heroSlides: ImageMeta[]; logo?: ImageMeta; aboutFeature?: ImageMeta };
    services: Array<{ t: string; tag: string; d: string; images: ImageMeta[] }>;
    testimonials: Array<{
        q: string;
        a: string;
        r: string;
        company: string;
        stars: number;
    }>;
    heroBullets: Array<{ value: string; label: string }>;
    faqs: Array<{ q: string; a: string }>;
    /**
     * Enterprise tier only: additional sites beyond the primary. Each entry
     * uses a reduced field set; missing fields inherit from the primary site
     * during mapping.
     */
    additionalSites?: AdditionalSiteEntry[];
}

export interface AdditionalSiteEntry {
    brandName: string;
    brandShort: string;
    brandTagline: string;
    email: string;
    phone: string;
    address: string;
    paletteAccent: string;
    paletteBg: string;
    paletteBgSoft: string;
    paletteInk: string;
    paletteInkSoft: string;
    paletteRule: string;
    heroHeadline: string;
    heroSub: string;
    businessHours: string;
    usp: string;
    services: Array<{ t: string; tag: string; d: string; images: ImageMeta[] }>;
    faqs: Array<{ q: string; a: string }>;
}

// ─── Intake envelope ──────────────────────────────────────────────────────────

export interface Intake {
    plan: "starter" | "growth" | "enterprise";
    siteCount: number;
    sites: SiteContent[];
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function or(value: string, fallback: string): string {
    return value && value.trim() ? value : fallback;
}

function orNull(value: string): string | null {
    return value && value.trim() ? value : null;
}

function phoneHrefFor(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, "");
    return digits ? `tel:${digits}` : "";
}

/**
 * Convert the sanitized onboarding form submission into the SiteContent
 * shape consumed by business-site-template/src/data/site.ts.
 *
 * Fields the form didn't provide are set to null (or sensible defaults for
 * non-nullable strings) and tracked in _meta.missing_fields per the JDD plan:
 * "never invent values for flagged fields — leave placeholders for human review."
 */
export function mapPayloadToSchema(p: OnboardingSubmission): SiteContent {
    const missing: string[] = [];
    const flag = (path: string, val: string) => {
        if (!val || !val.trim()) missing.push(path);
    };

    // Required-ish (forms with empty results still flag for human review)
    flag("brand.tagline", p.businessDetails.brandTagline);
    flag("brand.address", p.contact.address);
    flag("hero.headline", p.hero.heroHeadline);
    flag("hero.sub", p.hero.heroSub);
    flag("about.body", p.about.aboutBody);
    flag("seo.title", p.seo.seoTitle);
    flag("seo.description", p.seo.seoDescription);

    if (p.services.length === 0) missing.push("services.items");
    if (p.testimonials.length === 0) missing.push("testimonials.items");
    if (p.faqs.length === 0) missing.push("faq.items");

    return {
        brand: {
            name: p.contact.brandName,
            short: or(p.contact.brandShort, p.contact.brandName),
            long: or(p.contact.brandLong, p.contact.brandName),
            established: orNull(p.businessDetails.established),
            tagline: p.businessDetails.brandTagline,
            phone: p.contact.phone,
            phoneHref: phoneHrefFor(p.contact.phone),
            email: p.contact.email,
            address: p.contact.address,
            license: orNull(p.contact.license),
            palette: {
                accent: p.branding.paletteAccent,
                bg: p.branding.paletteBg,
                bgSoft: p.branding.paletteBgSoft,
                ink: p.branding.paletteInk,
                inkSoft: p.branding.paletteInkSoft,
                rule: p.branding.paletteRule,
            },
            typography: {
                fontSans:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontHeading:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                headingWeight: 700,
                bodyWeight: 400,
                headingTracking: "-0.01em",
                headingLineHeight: 1.2,
            },
        },
        nav: [
            { label: "About", href: "#about" },
            { label: "Services", href: "#services" },
            { label: "Work", href: "#work" },
            { label: "Reviews", href: "#testimonials" },
            { label: "FAQ", href: "#faq" },
            { label: "Book", href: "#cta" },
        ],
        announcement: orNull(p.announcement),
        trust: { label: "Trusted by", logos: [] },
        hero: {
            eyebrow: p.hero.heroEyebrow,
            headline: p.hero.heroHeadline,
            headlineEmphasis: orNull(p.hero.heroHeadlineEmphasis),
            sub: p.hero.heroSub,
            formLabel: "Get a free estimate — we'll reach out same day.",
            placeholder: "Your email address",
            cta: or(p.hero.heroCta, "Get Started"),
            secondaryCta: or(p.hero.heroSecondaryCta, `Call ${p.contact.phone}`),
            trust: p.businessDetails.usp,
            badge: orNull(p.hero.heroBadge),
            frictionReducers: p.hero.heroFrictionReducers,
            heroBullets: p.heroBullets,
            rotatingImages: [],
        },
        about: {
            eyebrow: p.about.aboutEyebrow,
            title: p.about.aboutTitle,
            body: p.about.aboutBody,
            pillars: p.about.pillars,
            stats: p.about.stats,
        },
        services: {
            eyebrow: p.servicesSection.servicesEyebrow,
            title: p.servicesSection.servicesTitle,
            sub: p.servicesSection.servicesSub,
            items: p.services.map((s, i) => ({
                n: String(i + 1).padStart(2, "0"),
                t: s.t,
                d: s.d,
                tag: s.tag,
                image: s.images[0]
                    ? { url: s.images[0].url, alt: s.images[0].alt }
                    : null,
            })),
        },
        work: {
            eyebrow: p.work.workEyebrow,
            title: p.work.workTitle,
            sub: p.work.workSub,
            hidden: p.work.projects.length === 0,
            projects: p.work.projects.map((pr) => ({
                t: pr.t,
                loc: pr.loc,
                yr: orNull(pr.yr),
                scope: pr.scope,
                size: pr.size,
                caption: pr.caption,
                image: pr.image
                    ? { url: pr.image.url, alt: pr.image.alt }
                    : null,
            })),
        },
        testimonials: {
            eyebrow: p.testimonialsMeta.testimonialsEyebrow,
            title: p.testimonialsMeta.testimonialsTitle,
            items: p.testimonials.map((t) => ({
                q: t.q,
                a: t.a,
                r: t.r,
                company: orNull(t.company),
                stars: t.stars,
            })),
        },
        faq: {
            eyebrow: p.faqMeta.faqEyebrow,
            title: p.faqMeta.faqTitle,
            sub: p.faqMeta.faqSub,
            items: p.faqs,
        },
        finalCta: {
            eyebrow: p.finalCta.finalCtaEyebrow,
            headline: p.finalCta.finalCtaHeadline,
            sub: p.finalCta.finalCtaSub,
            cta: p.finalCta.finalCtaCta,
            secondary: orNull(p.finalCta.finalCtaSecondary),
            frictionReducers: p.finalCta.finalCtaFrictionReducers,
        },
        footer: {
            blurb: p.footer.footerBlurb,
            cols: [],
            social: [
                p.socialMedia.linkedin
                    ? { label: "LinkedIn", href: p.socialMedia.linkedin }
                    : null,
                p.socialMedia.instagram
                    ? { label: "Instagram", href: p.socialMedia.instagram }
                    : null,
                p.socialMedia.facebook
                    ? { label: "Facebook", href: p.socialMedia.facebook }
                    : null,
                p.socialMedia.youtube
                    ? { label: "YouTube", href: p.socialMedia.youtube }
                    : null,
            ].filter((x): x is FooterLink => x !== null),
            legalLinks: [],
            legal: p.footer.footerLegal,
        },
        seo: {
            title: p.seo.seoTitle,
            description: p.seo.seoDescription,
            canonical: p.seo.seoCanonical,
            googleAnalyticsId: orNull(p.seo.googleAnalyticsId),
            facebookPixelId: orNull(p.seo.facebookPixelId),
        },
        extensions: {
            trustBadges: p.businessDetails.certifications
                ? p.businessDetails.certifications.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
                : null,
            reviewBadge: null,
            contactDetails: p.contact.address
                ? { address: p.contact.address, mapsUrl: orNull(p.extensions.mapsUrl) }
                : null,
            hours: p.businessDetails.businessHours
                ? { all: p.businessDetails.businessHours }
                : null,
            bookingUrl: orNull(p.extensions.bookingUrl),
            portalUrl: orNull(p.extensions.portalUrl),
            socialMedia: {
                linkedin: orNull(p.socialMedia.linkedin),
                instagram: orNull(p.socialMedia.instagram),
                facebook: orNull(p.socialMedia.facebook),
                youtube: orNull(p.socialMedia.youtube),
            },
        },
        images: {
            hero: {
                portrait: p.images.heroSlides[0]?.url,
                slides: p.images.heroSlides.map((img) => ({ url: img.url, alt: img.alt })),
            },
            about: { feature: p.images.aboutFeature?.url },
            work: { cards: [] },
            testimonials: {},
            footer: { logoImage: p.images.logo?.url },
        },
        _meta: {
            schema_version: "2.1",
            generated_at: new Date().toISOString(),
            variation: "D",
            is_placeholder: false,
            missing_fields: missing,
            selectedPlan: p.selectedPlan,
        },
    };
}

/**
 * Build an additional Enterprise site by overlaying a reduced-form entry on
 * top of the primary site's content. Anything not in the additional-site form
 * inherits from the primary site (typography, SEO defaults, footer copy, nav).
 */
function buildAdditionalSite(
    primary: SiteContent,
    add: AdditionalSiteEntry,
    siteIndex: number,
    siteCount: number,
    siblingSlugs: string[],
): SiteContent {
    const missing: string[] = [];
    const flag = (path: string, val: string) => {
        if (!val || !val.trim()) missing.push(path);
    };
    flag("brand.tagline", add.brandTagline);
    flag("brand.address", add.address);
    flag("hero.headline", add.heroHeadline);
    flag("hero.sub", add.heroSub);
    if (add.services.length === 0) missing.push("services.items");
    if (add.faqs.length === 0) missing.push("faq.items");

    return {
        ...primary,
        brand: {
            ...primary.brand,
            name: add.brandName,
            short: or(add.brandShort, add.brandName),
            long: add.brandName,
            tagline: add.brandTagline,
            phone: add.phone,
            phoneHref: phoneHrefFor(add.phone),
            email: add.email,
            address: add.address,
            palette: {
                accent: add.paletteAccent,
                bg: add.paletteBg,
                bgSoft: add.paletteBgSoft,
                ink: add.paletteInk,
                inkSoft: add.paletteInkSoft,
                rule: add.paletteRule,
            },
        },
        hero: {
            ...primary.hero,
            headline: add.heroHeadline,
            sub: add.heroSub,
            trust: add.usp,
        },
        services: {
            ...primary.services,
            items: add.services.map((s, i) => ({
                n: String(i + 1).padStart(2, "0"),
                t: s.t,
                d: s.d,
                tag: s.tag,
                image: s.images[0]
                    ? { url: s.images[0].url, alt: s.images[0].alt }
                    : null,
            })),
        },
        faq: {
            ...primary.faq,
            items: add.faqs,
        },
        extensions: {
            ...primary.extensions,
            contactDetails: add.address
                ? { address: add.address, mapsUrl: null }
                : null,
            hours: add.businessHours ? { all: add.businessHours } : null,
        },
        _meta: {
            ...primary._meta,
            generated_at: new Date().toISOString(),
            missing_fields: missing,
            siteIndex,
            siteCount,
            siblingSlugs,
        },
    };
}

/**
 * Convert a submission to an Intake envelope. Single-site for starter/growth;
 * N-site for enterprise.
 */
export function mapPayloadToIntake(p: OnboardingSubmission): Intake {
    const primary = mapPayloadToSchema(p);
    const additionalEntries = (p.additionalSites ?? []).filter((a) => a && a.brandName);

    if (p.selectedPlan !== "enterprise" || additionalEntries.length === 0) {
        return {
            plan: p.selectedPlan,
            siteCount: 1,
            sites: [
                {
                    ...primary,
                    _meta: { ...primary._meta, siteIndex: 1, siteCount: 1, siblingSlugs: [] },
                },
            ],
        };
    }

    const slugify = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const baseSlug = slugify(primary.brand.short || primary.brand.name);
    const allSiteShorts = [primary.brand.short, ...additionalEntries.map((a) => or(a.brandShort, a.brandName))];
    const siteCount = allSiteShorts.length;
    const allSlugs = allSiteShorts.map((_, i) => `${baseSlug}-${i + 1}`);

    const sites: SiteContent[] = [
        {
            ...primary,
            _meta: {
                ...primary._meta,
                siteIndex: 1,
                siteCount,
                siblingSlugs: allSlugs.slice(1),
            },
        },
        ...additionalEntries.map((entry, i) =>
            buildAdditionalSite(
                primary,
                entry,
                i + 2,
                siteCount,
                allSlugs.filter((_, j) => j !== i + 1),
            ),
        ),
    ];

    return { plan: "enterprise", siteCount, sites };
}
