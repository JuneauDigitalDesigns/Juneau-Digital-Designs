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
 * The public pages, in the order the sitemap lists them. A page that is not here is not in the
 * sitemap: the portal, sign-in, checkout, payment links, `/start`, `/terms/accept` and every
 * private `/terms/[code]` link stay out on purpose.
 */
export const PUBLIC_PATHS = ["/", "/pricing", "/faq", "/activation", "/terms", "/privacy-policy", "/sms-terms"] as const;
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
