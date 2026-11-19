import type { MetadataRoute } from "next";
import { SITE_URL } from "@/app/lib/site-seo";

/**
 * /robots.txt. Cloudflare sits in front of the site and prepends its own content-signals notice
 * to whatever this returns; these rules follow it.
 *
 * Only `/api/` is blocked. The portal, checkout, payment and private Terms pages are kept out of
 * search with a "noindex" tag instead: a crawler has to be allowed to fetch a page to read that
 * tag, and a blocked page can still be listed from links that point at it.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
