import "server-only";
import { listCustomers } from "./portal-crm";
import { getLead } from "./portal-leads";
import { classifyDeepLink, isDeepLinkId, type DeepLinkTarget } from "./crm-contacts";

/**
 * Where an owner's text should land.
 *
 * The texts the voice stack sends carry `/portal/l/<shortid>`, which resolves to one inbox
 * item and redirects into the portal opened on it. That route does the ownership check; this
 * answers the question it cannot: *which* view still holds this thing.
 *
 * The answer is not always the inbox, and that is the point. A lead the client has already
 * promoted is no longer in the inbox at all — `filterInbox` hides promoted items, because the
 * inbox is a worklist — so a redirect that sent them there would open an ordinary inbox with
 * no sign of the lead they tapped, minutes after being told it was waiting for them.
 *
 * Reads KV only. Deliberately: the caller is a redirect on the hot path of a text message, and
 * an Airtable round trip there would put a slow third party between tapping a link and seeing
 * the portal. The consequence is stated on `kind: "inbox"` below.
 */

export type { DeepLinkTarget };

/**
 * Never throws. A KV hiccup, a malformed id, a half-written record — all of it comes back as
 * `gone`, which the caller turns into the same plain-inbox redirect a foreign id gets. A text
 * message that opens a 500 is worse than one that opens the inbox.
 */
export async function resolveInboxDeepLink(
    acctScope: string,
    slug: string,
    itemId: string,
): Promise<DeepLinkTarget> {
    try {
        if (!isDeepLinkId(itemId)) return { kind: "gone" };

        /**
         * Which customer this source ref became, if any.
         *
         * Scanned rather than indexed. `promotedIndex` is a bare set of refs with no customer
         * attached, and `Customer.sourceRef` is the only record of where a customer came from,
         * so the mapping has to be derived. A board holds tens of customers, not thousands,
         * and this runs once per tapped link — an index would be a second thing to keep true
         * for no gain anyone could measure.
         */
        const customers = await listCustomers(acctScope, slug);
        const promoted = customers.find((c) => c.sourceRef === itemId);
        if (promoted) {
            return classifyDeepLink(itemId, promoted.customerId, null);
        }

        /**
         * A lead can be proven absent; a call cannot, from here.
         *
         * The lead store is KV and answers in one get. A call lives in Airtable, which this
         * will not reach — so an unknown `rec…` comes back as `inbox` rather than `gone`. That
         * is safe: the inbox opens nothing it cannot find and renders normally, which is
         * exactly what the caller does with `gone` anyway. Both ends are the plain inbox; only
         * the route taken differs.
         */
        const leadId = itemId.startsWith("lead:") ? itemId.slice("lead:".length) : null;
        const leadExists = leadId ? (await getLead(acctScope, slug, leadId)) !== null : null;

        return classifyDeepLink(itemId, null, leadExists);
    } catch (e) {
        console.error(`[portal/deep-link] ${slug} ${itemId} failed`, e);
        return { kind: "gone" };
    }
}
