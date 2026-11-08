import "server-only";
import { siteFeature } from "@jdd/schema";
import { fetchCalls } from "./airtable-calls";
import { accountScope } from "./portal-kv";
import { consentBlock, spokenConsentFor } from "./spoken-consent";

type Ctx = {
    account: { email: string; sites: { slug: string; airtableBaseId?: string | null }[] };
    site: Parameters<typeof siteFeature>[0] & { slug: string; airtableBaseId?: string | null };
};

/**
 * May this number be texted, going by what was said on calls?
 *
 * Read at send time, from the client's own call log. A site with no call log has nothing to
 * check. A log that can't be read is `unavailable`, and the caller refuses to send: this exists to
 * stop texting someone who said no, so not knowing is not permission.
 */
export async function checkSpokenConsent(
    ctx: Ctx,
    e164: string | null,
): Promise<"ok" | "declined" | "not-agreed" | "unavailable"> {
    if (siteFeature(ctx.site, "calls").state !== "ready") return "ok";
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = ctx.site.airtableBaseId;
    if (!apiKey || !baseId) return "unavailable";

    const res = await fetchCalls({
        baseId,
        apiKey,
        siteSlug: ctx.site.slug,
        scopeToSite: ctx.account.sites.some((s) => s.slug !== ctx.site.slug && s.airtableBaseId === baseId),
        acctScope: accountScope(ctx.account.email),
    });
    if (!res.ok) return "unavailable";
    return consentBlock(spokenConsentFor(res.calls, e164)) ?? "ok";
}
