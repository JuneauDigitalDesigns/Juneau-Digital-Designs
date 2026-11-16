import type { PortalSite } from "@jdd/schema";

/**
 * Search Growth, the paid Search Console add-on (Xander, 2026-11-16): whether a site has it now.
 * The weekly job's proposals, the client's page-addition notices and the facts wizard all ask this
 * one question. `searchAddon` is written only by billing (the Stripe webhook mirror); this only
 * reads it. "ending" runs to the end of the paid month: the site keeps it until `endsAt`.
 */
export function hasSearchGrowth(site: Pick<PortalSite, "searchAddon">, now = Date.now()): boolean {
    const a = site.searchAddon;
    if (!a) return false;
    if (a.status === "active") return true;
    return a.status === "ending" && (a.endsAt === undefined || now < a.endsAt);
}
