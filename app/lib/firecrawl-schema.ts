/**
 * Firecrawl extraction schema + mapper — CANONICAL SOURCE OF TRUTH.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  AUTO-SYNCED FILE — do not edit the copies.                                │
 * │  Canonical: templates/business-site-template/business-template/src/data/   │
 * │             firecrawl-schema.ts                                            │
 * │  Copies:    ops/jdd-ops/studio/preview/src/data/firecrawl-schema.ts        │
 * │             ops/juneau-digital-designs/app/lib/firecrawl-schema.ts         │
 * │  Sync with: (from studio/preview)  npm run sync-schema                     │
 * │  Drift is caught by:               npm run check-schema  (runs in lint)    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Purpose: when an operator scrapes a client's existing website in the studio,
 * Firecrawl returns JSON shaped by `firecrawlExtractionSchema` below. That JSON
 * mirrors the *scrapable subset* of `SiteContent` (see site.ts / site-schema.ts)
 * so `mapScrapeToSiteContent()` can lift it onto SiteContent paths with no
 * guesswork. Un-scrapable fields (palette, typography, friction reducers, etc.)
 * are intentionally left unset so the studio's vertical preset fills them — we
 * never invent values (per jdd-ops + business-template CLAUDE.md hard rules).
 *
 * This module is self-contained on purpose (no cross-file imports) so the three
 * copies are byte-identical and the drift guard can do a pure file comparison.
 */

// ─── Shape Firecrawl returns (matches firecrawlExtractionSchema) ──────────────

export interface ScrapedContent {
  brand?: {
    name?: string;
    long?: string;
    tagline?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  hero?: { headline?: string; sub?: string };
  about?: { title?: string; body?: string };
  services?: { items?: Array<{ t?: string; d?: string; tag?: string }> };
  testimonials?: {
    items?: Array<{ q?: string; a?: string; r?: string; company?: string; stars?: number }>;
  };
  faq?: { items?: Array<{ q?: string; a?: string }> };
  nav?: Array<{ label?: string; href?: string }>;
  seo?: { title?: string; description?: string };
  socialLinks?: Array<{ label?: string; href?: string }>;
  logoUrl?: string;
}

// ─── Deep-partial SiteContent the mapper emits (kept self-contained) ──────────

export interface MappedScrape {
  brand?: {
    name?: string;
    long?: string;
    tagline?: string;
    phone?: string;
    phoneHref?: string;
    email?: string;
    address?: string;
  };
  hero?: { headline?: string; sub?: string };
  about?: { title?: string; body?: string };
  services?: { items?: Array<{ n: string; t: string; d: string; tag: string }> };
  testimonials?: {
    items?: Array<{ q: string; a: string; r: string; company?: string; stars: number }>;
  };
  faq?: { items?: Array<{ q: string; a: string }> };
  nav?: Array<{ label: string; href: string }>;
  seo?: { title?: string; description?: string };
  footer?: { social?: Array<{ label: string; href: string }> };
  images?: { footer?: { logoImage?: string } };
  _meta?: {
    scrapeExistingWebsite: boolean;
    scrapeWebsiteDomain: string;
    missing_fields: string[];
  };
}

// ─── Firecrawl JSON-format extraction schema ──────────────────────────────────
// Passed to POST /v2/scrape as formats: [{ type: 'json', schema: ... }].
// Field names mirror SiteContent so mapping is near-identity. Nothing is marked
// required — extraction is best-effort and gaps cascade to the vertical preset.

export const firecrawlExtractionSchema = {
  type: 'object',
  properties: {
    brand: {
      type: 'object',
      description: 'Core business identity pulled from the page header, footer, and contact info.',
      properties: {
        name: { type: 'string', description: 'Short brand name as shown in the logo / header.' },
        long: { type: 'string', description: 'Full legal business name, e.g. "Peak Home Services LLC".' },
        tagline: { type: 'string', description: 'Short slogan or one-line value statement.' },
        phone: { type: 'string', description: 'Primary phone number as displayed.' },
        email: { type: 'string', description: 'Primary contact email address.' },
        address: { type: 'string', description: 'Physical street address / service location.' },
      },
    },
    hero: {
      type: 'object',
      description: 'The main above-the-fold headline area of the homepage.',
      properties: {
        headline: { type: 'string', description: 'Primary hero headline.' },
        sub: { type: 'string', description: 'Supporting subheadline / lead paragraph under the headline.' },
      },
    },
    about: {
      type: 'object',
      description: 'About / who-we-are section.',
      properties: {
        title: { type: 'string', description: 'About section heading.' },
        body: { type: 'string', description: 'About section paragraph describing the business.' },
      },
    },
    services: {
      type: 'object',
      description: 'Services / offerings the business provides.',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              t: { type: 'string', description: 'Service name.' },
              d: { type: 'string', description: 'One-sentence description of the service.' },
              tag: { type: 'string', description: 'Short category label for the service.' },
            },
          },
        },
      },
    },
    testimonials: {
      type: 'object',
      description: 'Customer reviews / testimonials.',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'The testimonial quote text.' },
              a: { type: 'string', description: 'Author name.' },
              r: { type: 'string', description: 'Author role or descriptor (e.g. "Homeowner").' },
              company: { type: 'string', description: 'Company or location of the author, if shown.' },
              stars: { type: 'number', description: 'Star rating 1-5 if shown.' },
            },
          },
        },
      },
    },
    faq: {
      type: 'object',
      description: 'Frequently asked questions.',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'The question.' },
              a: { type: 'string', description: 'The answer.' },
            },
          },
        },
      },
    },
    nav: {
      type: 'array',
      description: 'Primary navigation links from the site header.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Nav link text.' },
          href: { type: 'string', description: 'Nav link target (path, anchor, or URL).' },
        },
      },
    },
    seo: {
      type: 'object',
      description: 'Page metadata.',
      properties: {
        title: { type: 'string', description: 'The <title> / SEO title of the page.' },
        description: { type: 'string', description: 'The meta description of the page.' },
      },
    },
    socialLinks: {
      type: 'array',
      description: 'Social media profile links (Instagram, Facebook, etc.).',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Platform name, e.g. "Instagram".' },
          href: { type: 'string', description: 'Full URL to the social profile.' },
        },
      },
    },
    logoUrl: { type: 'string', description: 'Absolute URL of the business logo image, if present.' },
  },
} as const;

/** Natural-language prompt that accompanies the schema to steer extraction. */
export const firecrawlExtractionPrompt =
  'Extract the business identity, hero headline and subheadline, about text, ' +
  'list of services, customer testimonials, FAQs, primary navigation links, ' +
  'page SEO title and description, social media links, and logo image URL. ' +
  'Only include content that actually appears on the page; omit anything missing.';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a tel: href from a displayed phone number (US-aware). */
export function phoneToHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `tel:+1${digits}`;
  return `tel:+${digits}`;
}

function nonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Set key only when the value is a non-empty string. Returns the target. */
function putStr(target: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value === 'string' && value.trim() !== '') target[key] = value.trim();
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Lift a Firecrawl extraction onto SiteContent paths. Returns a deep-partial
 * object suitable for `deepMerge(mapped, importedSiteContent)` — i.e. scraped
 * values are the floor and any operator-provided intake values override them.
 *
 * @param extracted the `json` payload from Firecrawl (may be partial/empty)
 * @param domain    the domain that was scraped (recorded into _meta)
 */
export function mapScrapeToSiteContent(extracted: ScrapedContent, domain: string): MappedScrape {
  const out: MappedScrape = {};
  const e = extracted ?? {};

  // brand
  if (e.brand) {
    const brand: NonNullable<MappedScrape['brand']> = {};
    putStr(brand, 'name', e.brand.name);
    putStr(brand, 'long', e.brand.long);
    putStr(brand, 'tagline', e.brand.tagline);
    putStr(brand, 'phone', e.brand.phone);
    putStr(brand, 'email', e.brand.email);
    putStr(brand, 'address', e.brand.address);
    if (typeof e.brand.phone === 'string' && e.brand.phone.trim() !== '') {
      const href = phoneToHref(e.brand.phone);
      if (href) brand.phoneHref = href;
    }
    if (Object.keys(brand).length) out.brand = brand;
  }

  // hero
  if (e.hero) {
    const hero: NonNullable<MappedScrape['hero']> = {};
    putStr(hero, 'headline', e.hero.headline);
    putStr(hero, 'sub', e.hero.sub);
    if (Object.keys(hero).length) out.hero = hero;
  }

  // about
  if (e.about) {
    const about: NonNullable<MappedScrape['about']> = {};
    putStr(about, 'title', e.about.title);
    putStr(about, 'body', e.about.body);
    if (Object.keys(about).length) out.about = about;
  }

  // services
  const svc = (e.services?.items ?? [])
    .filter((s) => nonEmpty(s?.t) || nonEmpty(s?.d))
    .map((s, i) => ({
      n: String(i + 1).padStart(2, '0'),
      t: (s.t ?? '').trim(),
      d: (s.d ?? '').trim(),
      tag: (s.tag ?? '').trim(),
    }));
  if (svc.length) out.services = { items: svc };

  // testimonials
  const tst = (e.testimonials?.items ?? [])
    .filter((t) => nonEmpty(t?.q))
    .map((t) => {
      const item: { q: string; a: string; r: string; company?: string; stars: number } = {
        q: (t.q ?? '').trim(),
        a: (t.a ?? '').trim(),
        r: (t.r ?? '').trim(),
        stars: typeof t.stars === 'number' && t.stars >= 1 && t.stars <= 5 ? Math.round(t.stars) : 5,
      };
      if (nonEmpty(t.company)) item.company = (t.company ?? '').trim();
      return item;
    });
  if (tst.length) out.testimonials = { items: tst };

  // faq
  const faq = (e.faq?.items ?? [])
    .filter((f) => nonEmpty(f?.q) && nonEmpty(f?.a))
    .map((f) => ({ q: (f.q ?? '').trim(), a: (f.a ?? '').trim() }));
  if (faq.length) out.faq = { items: faq };

  // nav
  const nav = (e.nav ?? [])
    .filter((n) => nonEmpty(n?.label))
    .map((n) => ({ label: (n.label ?? '').trim(), href: (n.href ?? '#').trim() || '#' }));
  if (nav.length) out.nav = nav;

  // seo
  if (e.seo) {
    const seo: NonNullable<MappedScrape['seo']> = {};
    putStr(seo, 'title', e.seo.title);
    putStr(seo, 'description', e.seo.description);
    if (Object.keys(seo).length) out.seo = seo;
  }

  // footer social
  const social = (e.socialLinks ?? [])
    .filter((s) => nonEmpty(s?.href))
    .map((s) => ({ label: (s.label ?? '').trim() || 'Link', href: (s.href ?? '').trim() }));
  if (social.length) out.footer = { social };

  // logo
  if (nonEmpty(e.logoUrl)) out.images = { footer: { logoImage: (e.logoUrl ?? '').trim() } };

  // meta — record what the scrape could NOT fill, so the studio can show it.
  const checks: Array<[string, boolean]> = [
    ['brand.name', nonEmpty(out.brand?.name)],
    ['brand.phone', nonEmpty(out.brand?.phone)],
    ['brand.email', nonEmpty(out.brand?.email)],
    ['brand.address', nonEmpty(out.brand?.address)],
    ['hero.headline', nonEmpty(out.hero?.headline)],
    ['about.body', nonEmpty(out.about?.body)],
    ['services.items', nonEmpty(out.services?.items)],
    ['testimonials.items', nonEmpty(out.testimonials?.items)],
    ['faq.items', nonEmpty(out.faq?.items)],
    ['seo.title', nonEmpty(out.seo?.title)],
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([field]) => field);

  out._meta = {
    scrapeExistingWebsite: false,
    scrapeWebsiteDomain: domain,
    missing_fields: missing,
  };

  return out;
}
