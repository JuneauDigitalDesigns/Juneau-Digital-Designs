import "server-only";
import { normalizeE164 } from "./phone";
import { accountScope } from "./portal-kv";
import { findCustomerByPhone, getReviewSend, type Customer } from "./portal-crm";
import { getLead } from "./portal-leads";
import { readSpokenConsent, type Ctx } from "./spoken-consent-check";
import { decideTextConsent, formConsentCovers, type TextConsentRefusal } from "./text-consent";
import { issueTextConsentToken, type CustomerTextConsent } from "./customer-text-consent-token";

/**
 * The consent gate every path that texts a customer goes through (portal replies, review
 * requests). Rule: `text-consent.ts`. Fails closed: anything it can't read is a refusal.
 *
 * Returns a token that `sendSms` requires on the customer lane, so a send that skipped this
 * cannot happen.
 */
export async function checkCustomerTextConsent(
    ctx: Ctx,
    { phone, customer }: { phone: string | null; customer?: Customer | null },
): Promise<{ ok: true; consent: CustomerTextConsent } | { ok: false; reason: TextConsentRefusal | "no-number" }> {
    const e164 = normalizeE164(phone ?? "");
    if (!e164) return { ok: false, reason: "no-number" };
    const acct = accountScope(ctx.account.email);
    const slug = ctx.site.slug;
    try {
        const optedOut = Boolean((await getReviewSend(acct, e164))?.optedOut);
        const spoken = await readSpokenConsent(ctx, e164);

        // The form's record lives on the lead the customer came from. `source`/`sourceRef` are
        // written by the client, so the lead is re-read and must be for this same number.
        const record = customer ?? (await findCustomerByPhone(acct, slug, e164));
        let formCovers = false;
        if (record?.phone === e164 && record.sourceRef?.startsWith("lead:")) {
            const lead = await getLead(acct, slug, record.sourceRef.slice("lead:".length));
            formCovers = formConsentCovers(lead, e164);
        }

        const decision = decideTextConsent({ optedOut, spoken, formCovers });
        return decision.ok ? { ok: true, consent: issueTextConsentToken(e164, decision.basis) } : decision;
    } catch (e) {
        console.error(`[text-consent] ${slug}: could not check consent`, e);
        return { ok: false, reason: "unavailable" };
    }
}
