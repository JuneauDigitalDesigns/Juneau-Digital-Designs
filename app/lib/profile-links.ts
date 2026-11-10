/**
 * Checks a business-profile link the client pasted (onboarding "Online profiles" screen), and
 * normalises it. One implementation, used by the wizard (to say what's wrong) and by the route's
 * sanitizer (to drop anything that slipped through).
 *
 * Rules agreed with client-seo (intake-seo-contract.md, 2026-11-10):
 *   - the host must match the kind: a Facebook link under "Google" helps nobody;
 *   - a search-results page is not a profile (google.com/search?…, yelp.com/search?…);
 *   - links only, never follower counts; "other" takes any http(s) link that isn't a search page.
 */

import type { ProfileKind } from "@jdd/schema";

export type LinkProblem = "" | "not-link" | "wrong-site" | "search";

/** Hosts (and their subdomains) that count as each kind. Google also needs a profile path. */
const HOSTS: Record<Exclude<ProfileKind, "other">, string[]> = {
    google: ["google.com", "maps.app.goo.gl", "goo.gl", "g.page", "business.google.com"],
    facebook: ["facebook.com", "fb.com", "fb.me"],
    yelp: ["yelp.com"],
    bbb: ["bbb.org"],
    angi: ["angi.com", "angieslist.com", "homeadvisor.com"],
    nextdoor: ["nextdoor.com"],
    instagram: ["instagram.com"],
};

/** Parse what the client pasted, adding https:// when they left it off. Null if it isn't a web link. */
export function parseLink(raw: string): URL | null {
    const v = (raw || "").trim();
    if (!v || /\s/.test(v)) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
    try {
        const u = new URL(withScheme);
        if (u.protocol !== "https:" && u.protocol !== "http:") return null;
        if (!u.hostname.includes(".")) return null;
        return u;
    } catch {
        return null;
    }
}

const onHost = (host: string, base: string) => host === base || host.endsWith(`.${base}`);

function isSearch(u: URL): boolean {
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (onHost(host, "google.com") && (path === "/search" || path.startsWith("/search/") || path === "/" )) return true;
    if (onHost(host, "bing.com") || onHost(host, "duckduckgo.com")) return true;
    return /(^|\/)search(\/|$)/.test(path);
}

/** What's wrong with the link, or "" when it's fine. A blank link is fine: the field is optional. */
export function profileLinkProblem(kind: ProfileKind, raw: string): LinkProblem {
    if (!(raw || "").trim()) return "";
    const u = parseLink(raw);
    if (!u) return "not-link";
    if (isSearch(u)) return "search";
    if (kind === "other") return "";
    const host = u.hostname.toLowerCase();
    if (!HOSTS[kind].some((b) => onHost(host, b))) return "wrong-site";
    // google.com itself is only a profile under /maps; the short-link hosts are always profiles.
    if (kind === "google" && onHost(host, "google.com") && !onHost(host, "business.google.com") && !u.pathname.toLowerCase().startsWith("/maps")) {
        return "search";
    }
    return "";
}

/** The link as it should be stored (scheme added, whitespace trimmed), or "" when it fails. */
export function normaliseProfileLink(kind: ProfileKind, raw: string): string {
    if (!(raw || "").trim() || profileLinkProblem(kind, raw)) return "";
    return parseLink(raw)?.toString() ?? "";
}
