import type { Metadata } from "next";
import { CONTACT } from "@/app/data/contact";
import type { FaqEntry } from "@/app/data/faq";
import { SCHEDULES } from "@/app/lib/legal/schedules";

/**
 * What search engines and link previews read about the agency site.
 *
 * Until 19 Nov 2026 the site had no sitemap, no robots rules, no canonical addresses, no link
 * previews and no structured data, and the homepage inherited the layout's leftover
 * "Innovative Web Design and UI/UX Solutions". Our own Terms promise every client site these
 * basics, so the agency site now has them too.
 *
 * Every visible-in-Google sentence here was approved by Xander word for word on 19 Nov 2026
 * (the homepage title and description, draft C1 without "in English or Spanish"; the pricing
 * description, draft C4). Do not edit without a fresh approval.
 */

/** The one address every canonical, sitemap entry and preview points at. The bare domain redirects here. */
export const SITE_URL = "https://www.juneaudigitaldesigns.com";
export const SITE_NAME = "Juneau Digital Designs";

export const HOME_TITLE = "Website + 24/7 AI Receptionist for Service Businesses | JDD";
export const HOME_DESCRIPTION =
    "We write, build and host your website, and an AI receptionist answers the calls you miss, 24/7. Every lead lands in one inbox. Month to month.";

export const PRICING_DESCRIPTION =
    "Monthly pricing for a small business website, a 24/7 AI receptionist that works as your answering service, and a portal where every lead lands. Month to month, no contract.";

/**
 * /hvac, the first trade page. Xander approved the title and description with the page itself,
 * from the fourth round of its mockup (19 Nov 2026). The price is Schedule A's, never typed: a
 * number written into a description is a number that can contradict the signed agreement.
 */
export const HVAC_TITLE = "HVAC Website Design + 24/7 AI Receptionist | JDD";
export const HVAC_DESCRIPTION = `We write, build and host your HVAC website, and an AI receptionist answers the heating and cooling calls you miss, 24/7. From $${SCHEDULES.starter.monthlyPrice} a month, no contract.`;

/**
 * /plumbing, the second trade page. Xander approved the title and description with the page,
 * from the third round of its mockup (19 Nov 2026). The price is Schedule A's, never typed.
 */
export const PLUMBING_TITLE = "Plumber Website Design + 24/7 AI Receptionist | JDD";
export const PLUMBING_DESCRIPTION = `We write, build and host your plumbing website, and an AI receptionist answers the calls you miss, 24/7, from burst pipes to water heaters. From $${SCHEDULES.starter.monthlyPrice} a month, no contract.`;

/**
 * /contact. Xander approved the page, with this title and description, from the round-1 mockup
 * (19 Nov 2026). Its /contact/thank-you child is deliberately NOT a public path: it is the
 * post-send landing page for Google Ads, is `noindex`, and never belongs in the sitemap.
 */
export const CONTACT_TITLE = "Contact Juneau Digital Designs | Website + AI Receptionist";
export const CONTACT_DESCRIPTION = `Tell us about your business and we'll come back to you with what a website and a 24/7 AI receptionist would look like for it. Or call ${CONTACT.phoneDisplay}.`;

/**
 * The public pages, in the order the sitemap lists them. A page that is not here is not in the
 * sitemap: the portal, sign-in, checkout, payment links, `/start`, `/terms/accept` and every
 * private `/terms/[code]` link stay out on purpose.
 */
export const PUBLIC_PATHS = [
    "/",
    "/about",
    "/hvac",
    "/plumbing",
    "/contact",
    "/pricing",
    "/faq",
    "/activation",
    "/terms",
    "/privacy-policy",
    "/sms-terms",
] as const;
export type PublicPath = (typeof PUBLIC_PATHS)[number];

/** The square logo, used as the link-preview picture until the site has a purpose-made one. */
const PREVIEW_IMAGE = { url: "/JDD_logo.png", width: 548, height: 541, alt: SITE_NAME };

/**
 * Title, description, canonical address and link-preview tags for one public page.
 *
 * Next does not copy a page's `title` into `og:title`, and a child page's `openGraph` replaces
 * the layout's whole object, so each page gets the full set from here rather than inheriting a
 * half-right preview from the root layout.
 */
export function pageMetadata(path: PublicPath, title: string, description: string): Metadata {
    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: {
            type: "website",
            siteName: SITE_NAME,
            locale: "en_US",
            url: path,
            title,
            description,
            images: [PREVIEW_IMAGE],
        },
        twitter: { card: "summary", title, description, images: [PREVIEW_IMAGE.url] },
    };
}

/* ── Structured data (schema.org JSON-LD) ──────────────────────────────────────────────────────
   Built only from facts the site already prints: the name, the footer's phone and email, the
   plan names and prices from Schedule A, and the FAQ answers. Nothing here is a claim the
   visible pages don't make. */

const ORG_ID = `${SITE_URL}/#organization`;
const PERSON_ID = `${SITE_URL}/about#xander-juneau`;

export function organizationJsonLd() {
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": ORG_ID,
                name: SITE_NAME,
                legalName: "Juneau Digital Designs LLC",
                url: SITE_URL,
                logo: `${SITE_URL}${PREVIEW_IMAGE.url}`,
                email: CONTACT.email,
                telephone: CONTACT.phoneHref.replace(/^tel:/, ""),
                founder: { "@id": PERSON_ID },
                contactPoint: {
                    "@type": "ContactPoint",
                    contactType: "customer support",
                    email: CONTACT.email,
                    telephone: CONTACT.phoneHref.replace(/^tel:/, ""),
                    availableLanguage: "English",
                },
            },
            {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                url: SITE_URL,
                name: SITE_NAME,
                publisher: { "@id": ORG_ID },
            },
        ],
    };
}

/** The three public plans as offers, priced from Schedule A so a price change reaches this too. */
export function plansJsonLd() {
    const plans = (["starter", "growth", "enterprise"] as const).map((slug) => SCHEDULES[slug]);
    return {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "Websites and a 24/7 AI receptionist",
        description: PRICING_DESCRIPTION,
        url: `${SITE_URL}/pricing`,
        provider: { "@type": "Organization", "@id": ORG_ID, name: SITE_NAME, url: SITE_URL },
        offers: plans.map((p) => ({
            "@type": "Offer",
            name: p.name,
            url: `${SITE_URL}/pricing`,
            priceCurrency: "USD",
            price: p.monthlyPrice,
            priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: p.monthlyPrice,
                priceCurrency: "USD",
                unitCode: "MON",
                referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
            },
        })),
    };
}

/**
 * /about, as a page about a person.
 *
 * Every field states something /about prints in words: his name, where he lives, the business
 * he founded, the degree and the certificate. Nothing is added here that the page does not say,
 * and nothing here may be edited without Xander's approval — these are claims about a real
 * person, and a search engine treats them as facts about him.
 */
export function aboutJsonLd() {
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "AboutPage",
                "@id": `${SITE_URL}/about#page`,
                url: `${SITE_URL}/about`,
                name: "Meet the owner",
                isPartOf: { "@id": `${SITE_URL}/#website` },
                about: { "@id": PERSON_ID },
                mainEntity: { "@id": PERSON_ID },
            },
            {
                "@type": "Person",
                "@id": PERSON_ID,
                name: "Xander Juneau",
                jobTitle: "Owner",
                worksFor: { "@id": ORG_ID },
                founderOf: { "@id": ORG_ID },
                homeLocation: {
                    "@type": "Place",
                    address: {
                        "@type": "PostalAddress",
                        addressLocality: "Winter Garden",
                        addressRegion: "FL",
                        addressCountry: "US",
                    },
                },
                alumniOf: [
                    { "@type": "CollegeOrUniversity", name: "Valencia College" },
                    { "@type": "EducationalOrganization", name: "Thinkful" },
                ],
                hasCredential: [
                    {
                        "@type": "EducationalOccupationalCredential",
                        name: "Associate in Science, Electronics Engineering Technology",
                        credentialCategory: "degree",
                        recognizedBy: { "@type": "CollegeOrUniversity", name: "Valencia College" },
                    },
                    {
                        "@type": "EducationalOccupationalCredential",
                        name: "Engineering Immersion Program",
                        credentialCategory: "certificate",
                        recognizedBy: { "@type": "EducationalOrganization", name: "Thinkful" },
                    },
                ],
            },
        ],
    };
}

/**
 * /hvac, as a page about one service for one trade.
 *
 * The Service says only what the page prints: a website and a 24/7 AI receptionist, for HVAC
 * companies, from this business, starting at Starter's price. No `areaServed`: whether trade
 * pages name a region is undecided (item C7 of the 19 Nov 2026 search check), and the page
 * names none.
 */
export function hvacJsonLd() {
    const starter = SCHEDULES.starter;
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": `${SITE_URL}/hvac#page`,
                url: `${SITE_URL}/hvac`,
                name: HVAC_TITLE,
                description: HVAC_DESCRIPTION,
                isPartOf: { "@id": `${SITE_URL}/#website` },
                about: { "@id": `${SITE_URL}/hvac#service` },
            },
            {
                "@type": "Service",
                "@id": `${SITE_URL}/hvac#service`,
                name: "Websites and a 24/7 AI receptionist for HVAC companies",
                serviceType: "Website design and AI answering service",
                description: HVAC_DESCRIPTION,
                url: `${SITE_URL}/hvac`,
                provider: { "@type": "Organization", "@id": ORG_ID, name: SITE_NAME, url: SITE_URL },
                audience: { "@type": "BusinessAudience", name: "HVAC companies" },
                offers: {
                    "@type": "Offer",
                    name: starter.name,
                    url: `${SITE_URL}/pricing`,
                    priceCurrency: "USD",
                    price: starter.monthlyPrice,
                    priceSpecification: {
                        "@type": "UnitPriceSpecification",
                        price: starter.monthlyPrice,
                        priceCurrency: "USD",
                        unitCode: "MON",
                        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
                    },
                },
            },
        ],
    };
}

/**
 * /plumbing, as a page about one service for one trade. Same shape as `hvacJsonLd`, because it
 * is the same offer to a different trade: no `areaServed`, since the page names no region.
 */
export function plumbingJsonLd() {
    const starter = SCHEDULES.starter;
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": `${SITE_URL}/plumbing#page`,
                url: `${SITE_URL}/plumbing`,
                name: PLUMBING_TITLE,
                description: PLUMBING_DESCRIPTION,
                isPartOf: { "@id": `${SITE_URL}/#website` },
                about: { "@id": `${SITE_URL}/plumbing#service` },
            },
            {
                "@type": "Service",
                "@id": `${SITE_URL}/plumbing#service`,
                name: "Websites and a 24/7 AI receptionist for plumbing companies",
                serviceType: "Website design and AI answering service",
                description: PLUMBING_DESCRIPTION,
                url: `${SITE_URL}/plumbing`,
                provider: { "@type": "Organization", "@id": ORG_ID, name: SITE_NAME, url: SITE_URL },
                audience: { "@type": "BusinessAudience", name: "Plumbing companies" },
                offers: {
                    "@type": "Offer",
                    name: starter.name,
                    url: `${SITE_URL}/pricing`,
                    priceCurrency: "USD",
                    price: starter.monthlyPrice,
                    priceSpecification: {
                        "@type": "UnitPriceSpecification",
                        price: starter.monthlyPrice,
                        priceCurrency: "USD",
                        unitCode: "MON",
                        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
                    },
                },
            },
        ],
    };
}

/**
 * /contact, as a ContactPage tied to the business.
 *
 * It states only what the page shows: the page is how you contact this organization, and the
 * phone and email are the footer's own (CONTACT). Nothing about an address or hours, because the
 * page lists none.
 */
export function contactJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "@id": `${SITE_URL}/contact#page`,
        url: `${SITE_URL}/contact`,
        name: CONTACT_TITLE,
        description: CONTACT_DESCRIPTION,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": ORG_ID },
        mainEntity: {
            "@type": "Organization",
            "@id": ORG_ID,
            name: SITE_NAME,
            url: SITE_URL,
            email: CONTACT.email,
            telephone: CONTACT.phoneHref.replace(/^tel:/, ""),
        },
    };
}

/** FAQ markup from the same entries the page prints, so the two cannot drift. */
export function faqJsonLd(entries: FaqEntry[]) {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: entries.map((e) => ({
            "@type": "Question",
            name: e.q,
            acceptedAnswer: { "@type": "Answer", text: Array.isArray(e.a) ? e.a.join("\n\n") : e.a },
        })),
    };
}

/** JSON for a `<script type="application/ld+json">`, with `<` escaped so no text can close the tag. */
export function jsonLdString(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
