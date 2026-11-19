import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_URL } from "@/app/lib/site-seo";

/**
 * /sitemap.xml: the public pages only (see `PUBLIC_PATHS`).
 *
 * No `lastModified`: nothing records when a page's words last changed, and a date that moves on
 * every deploy tells search engines nothing true.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    return PUBLIC_PATHS.map((path) => ({ url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}` }));
}
