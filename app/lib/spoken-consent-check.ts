import "server-only";
import { siteFeature } from "@jdd/schema";
import { fetchCalls } from "./airtable-calls";
import { accountScope } from "./portal-kv";
import { consentBlock, spokenConsentFor, type SpokenConsent } from "./spoken-consent";

export type Ctx = {
    account: { email: string; sites: { slug: string; airtableBaseId?: string | null }[] };
    site: Parameters<typeof siteFeature>[0] & { slug: string; airtableBaseId?: string | null };
};

/**
 * What was said on calls about texting this number, as recorded: `granted`, `declined`, `unknown`,
 * `null` when no call on record has this number (or the site keeps no call log), or `unavailable`
 * when the log couldn't be read. The consent gate (`customer-text-consent.ts`) decides from this;
 * unlike `checkSpokenConsent`, "no call on record" is not a pass.
 */
export async function readSpokenConsent(ctx: Ctx, e164: string | null): Promise<SpokenConsent | "unavailable"> {
    if (!e164) return null;
    if (siteFeature(ctx.site, "calls").state !== "ready") return null;
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = ctx.site.airtableBaseId;
    if (!apiKey || !baseId) return "unavailable";
    try {
        const res = await fetchCalls({
            baseId,
            apiKey,
            siteSlug: ctx.site.slug,
            scopeToSite: ctx.account.sites.some((s) => s.slug !== ctx.site.slug && s.airtableBaseId === baseId),
            acctScope: accountScope(ctx.account.email),
        });
        if (!res.ok) return "unavailable";
        return spokenConsentFor(res.calls, e164);
    } catch {
        return "unavailable";
    }
}

/**
 * May this number be texted, going by what was said on calls?
 *
 * Not the send gate any more: "no call on record" passes here. Sends go through
 * `checkCustomerTextConsent`, which requires consent on record.
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
