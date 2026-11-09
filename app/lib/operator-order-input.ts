import "server-only";
import {
    canAddPlan,
    isReceptionistMode,
    legacyMasterFrom,
    masterNeedsResign,
    normalizeEmail,
    type OperatorOrder,
    type PortalAccount,
} from "@jdd/schema";
import { normalizeE164 } from "./phone";
import { planLimits } from "./plan-limits";
import { TERMS_VERSION, getSchedule } from "./legal";
import { nextPaymentAt } from "./moto-charge.mjs";
import { scriptForOrder, termsHashForOrder } from "./verbal-agreement";

/**
 * Validation for an operator order, and the facts derived from it that the console shows.
 *
 * The phone and plan rules mirror `/api/agreement`'s `validate()` on purpose — a close on a
 * call must not be able to buy something the self-serve form would refuse.
 */

/** The fields the operator fills in. Everything else on the record is the server's. */
export type OrderFields = Pick<
    OperatorOrder,
    | "leadId"
    | "siteSlug"
    | "plan"
    | "period"
    | "client"
    | "vertical"
    | "receptionistMode"
    | "forwardingNumber"
    | "operator"
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Lowercase letters, digits and single hyphens. No underscores: Vercel *removes* characters that
 * aren't valid in a DNS label, so `a_b` serves at `ab.vercel.app` and every derived host breaks.
 */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function str(v: unknown): string {
    return typeof v === "string" ? v.trim() : "";
}

/** Parse and validate the operator's input. Returns the fields, or an error message. */
export function parseOrderFields(body: unknown): { fields: OrderFields } | { error: string } {
    const b = (body ?? {}) as Record<string, unknown>;
    const c = (b.client ?? {}) as Record<string, unknown>;

    const plan = str(b.plan);
    // v1 (PLAN §1, D3): Starter and Growth only. Enterprise carries consolidation and
    // multi-site rules that the call flow does not handle yet.
    if (plan === "enterprise") return { error: "Enterprise isn't available on a call yet." };
    if (plan !== "starter" && plan !== "growth") return { error: "Pick a plan." };

    const period = str(b.period) === "annual" ? "annual" : "monthly";

    const siteSlug = str(b.siteSlug).toLowerCase();
    if (!SLUG_RE.test(siteSlug) || siteSlug.length > 60) {
        return { error: "Site ID can use lowercase letters, numbers and single hyphens." };
    }

    const email = str(c.email);
    if (!EMAIL_RE.test(email)) return { error: "A valid email is required." };

    const required: [string, string][] = [
        ["legalName", "Legal business name"],
        ["entityType", "Entity type"],
        ["address", "Business address"],
        ["contactName", "Contact name"],
        ["contactTitle", "Title"],
        ["phone", "Contact mobile"],
    ];
    for (const [key, label] of required) {
        if (!str(c[key])) return { error: `${label} is required.` };
    }

    const leadId = str(b.leadId);
    const vertical = str(b.vertical);
    const operator = str(b.operator) || "xander";
    if (!leadId) return { error: "leadId is required." };
    if (!vertical) return { error: "Trade is required." };

    // Phone handling must be stated, never guessed (CLAUDE.md): the wrong guess either buys a
    // number for a client who declined or withholds one a client paid for.
    const mode = b.receptionistMode;
    if (!isReceptionistMode(mode)) return { error: "Choose a phone setup." };
    if (mode === "declined" && plan !== "starter") return { error: "Website only is Starter only." };
    const forwardingNumber = str(b.forwardingNumber);
    if (mode === "forwarded" && !normalizeE164(forwardingNumber)) {
        return { error: "Enter the business number customers call today." };
    }

    return {
        fields: {
            leadId,
            siteSlug,
            plan,
            period,
            vertical,
            operator,
            receptionistMode: mode,
            ...(mode === "forwarded" ? { forwardingNumber } : {}),
            client: {
                legalName: str(c.legalName),
                ...(str(c.dba) ? { dba: str(c.dba) } : {}),
                entityType: str(c.entityType),
                address: str(c.address),
                contactName: str(c.contactName),
                contactTitle: str(c.contactTitle),
                email: normalizeEmail(email),
                phone: str(c.phone),
            },
        },
    };
}

/**
 * What the agency knows about this buyer that the console can't: new or returning account,
 * master or addendum, and whether the plan is blocked. The same helpers `/start` uses, so a
 * call cannot sell what the website would refuse.
 */
export function accountFacts(
    account: PortalAccount | null,
    order: Pick<OperatorOrder, "plan" | "siteSlug">,
): {
    account: "new" | "existing";
    agreementKind: "master" | "addendum";
    parentAgreementId?: string;
    block: string | null;
    slugOnAccount: boolean;
} {
    if (!account) return { account: "new", agreementKind: "master", block: null, slugOnAccount: false };
    const master = account.masterAgreement ?? legacyMasterFrom(account.sites);
    // A reconstructed pre-cutover master has no record id to hang an addendum off, so it signs
    // a fresh master instead.
    const addendum = !masterNeedsResign(master, TERMS_VERSION, order.plan) && Boolean(master?.agreementId);
    return {
        account: "existing",
        agreementKind: addendum ? "addendum" : "master",
        ...(addendum && master?.agreementId ? { parentAgreementId: master.agreementId } : {}),
        block: canAddPlan(account, order.plan, planLimits()),
        slugOnAccount: account.sites.some((s) => s.slug === order.siteSlug),
    };
}

/** Everything the Terms step needs to display, and to send back for verification. */
export function termsView(order: OperatorOrder, kind: "master" | "addendum") {
    const script = scriptForOrder(order, kind);
    const schedule = getSchedule(order.plan);
    const recurring = order.period === "annual" ? schedule.annualPrice : schedule.monthlyPrice;
    return {
        script,
        termsHash: termsHashForOrder(order, kind),
        totals: {
            today: recurring + schedule.onboardingFee,
            recurring,
            period: order.period,
            // What the payment screens say renews when: a month or a year on, the same day.
            nextPaymentAt: nextPaymentAt(Date.now(), order.period),
        },
    };
}
